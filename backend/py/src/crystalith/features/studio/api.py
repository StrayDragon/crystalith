from __future__ import annotations

import asyncio
import datetime
import json
import os
from collections.abc import AsyncGenerator
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cl_logs.logging import get_logger

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.agents.models import ModelConfigurationError
from crystalith.shared.cache import CacheProvider
from crystalith.shared.observability import new_trace_id
from crystalith.shared.deps import (
    get_cache_provider,
    get_db_session,
    get_embedding_provider,
    get_settings,
    get_vector_store,
)
from crystalith.shared.db import Notebook, Output, Source, StudioSlide
from crystalith.shared.types import SlideStage, SlideStatus
from crystalith.shared.types import OutputType
from .slides import (
    SlideGenerationConfig,
    SlideOutline,
    generate_slides_markdown,
    generate_slides_outline,
    write_preview_markdown,
    write_slide_markdown,
)


log = get_logger(__name__)

router = APIRouter(prefix="/v1/notebooks/{notebook_id}/slides", tags=["slides"])

SLIDE_RUNNING_STALE_AFTER = datetime.timedelta(minutes=10)
SSE_TIMINGS_ENV = "CRYSTALITH_OBSERVABILITY_SSE_TIMINGS"


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


class SlideDraftCreate(BaseModel):
    title: str | None = None
    prompt: str | None = None
    engine: str = Field("slidev", description="Rendering engine (default: slidev)")
    source_ids: list[int] | None = None
    generation_config: SlideGenerationConfig | None = None


class SlideDraftUpdate(BaseModel):
    title: str | None = None
    prompt: str | None = None
    engine: str | None = None
    source_ids: list[int] | None = None
    generation_config: SlideGenerationConfig | None = None


class SlideOutlineUpdate(BaseModel):
    outline: SlideOutline


class SlideMarkdownUpdate(BaseModel):
    markdown: str


class SlideDraftRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    output_id: int | None
    title: str | None
    prompt: str | None
    engine: str
    chunk_ids: list[int] | None
    source_ids: list[int] | None
    outline: SlideOutline | None
    markdown: str | None
    generation_config: SlideGenerationConfig | None
    stage: SlideStage
    status: SlideStatus
    error_message: str | None
    created_at: datetime.datetime
    updated_at: datetime.datetime


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _coerce_utc(value: datetime.datetime) -> datetime.datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=datetime.UTC)
    return value.astimezone(datetime.UTC)


async def _clear_stale_running_status(session: AsyncSession, slide: StudioSlide) -> bool:
    if slide.status != SlideStatus.RUNNING or slide.updated_at is None:
        return False
    now = datetime.datetime.now(datetime.UTC)
    if now - _coerce_utc(slide.updated_at) <= SLIDE_RUNNING_STALE_AFTER:
        return False
    slide.status = SlideStatus.IDLE
    slide.error_message = None
    await session.commit()
    await session.refresh(slide)
    log.warning("cleared stale slide generation status", slide_id=slide.id)
    return True


async def _get_notebook(session: AsyncSession, notebook_id: int) -> Notebook:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return notebook


async def _get_slide(session: AsyncSession, notebook_id: int, slide_id: int) -> StudioSlide:
    slide = await session.get(StudioSlide, slide_id)
    if slide is None or slide.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Slide draft not found")
    return slide


def _normalize_source_ids(source_ids: list[int] | None) -> list[int]:
    if not source_ids:
        return []
    normalized = [int(value) for value in source_ids]
    if any(value <= 0 for value in normalized):
        raise HTTPException(status_code=400, detail="Unknown source_id in source_ids")
    return list(dict.fromkeys(normalized))


async def _validate_source_ids(
    session: AsyncSession,
    notebook_id: int,
    source_ids: list[int],
) -> None:
    if not source_ids:
        return
    rows = await session.execute(
        select(Source.id).where(
            Source.notebook_id == notebook_id,
            Source.id.in_(source_ids),
        )
    )
    found = {row[0] for row in rows.all()}
    missing = [source_id for source_id in source_ids if source_id not in found]
    if missing:
        raise HTTPException(status_code=400, detail="Unknown source_id in source_ids")


async def _sync_output(session: AsyncSession, slide: StudioSlide) -> Output:
    title = slide.title or "演示"
    outline = slide.outline or {}
    markdown = slide.markdown or ""
    content = {
        "title": title,
        "engine": slide.engine,
        "outline": outline,
        "markdown": markdown,
        "slide_id": slide.id,
    }

    if slide.output_id:
        output = await session.get(Output, slide.output_id)
        if output is not None:
            output.prompt = slide.prompt
            output.chunk_ids = slide.chunk_ids or None
            output.content = content
            await session.commit()
            await session.refresh(output)
            return output

    output = Output(
        notebook_id=slide.notebook_id,
        type=OutputType.SLIDES,
        prompt=slide.prompt,
        chunk_ids=slide.chunk_ids or None,
        content=content,
    )
    session.add(output)
    await session.commit()
    await session.refresh(output)
    slide.output_id = output.id
    await session.commit()
    await session.refresh(slide)
    return output


@router.get("/drafts/latest", response_model=SlideDraftRead)
async def get_latest_draft(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> SlideDraftRead:
    await _get_notebook(session, notebook_id)
    result = await session.execute(
        select(StudioSlide)
        .where(StudioSlide.notebook_id == notebook_id)
        .order_by(StudioSlide.updated_at.desc())
        .limit(1)
    )
    slide = result.scalar_one_or_none()
    if slide is None:
        raise HTTPException(status_code=404, detail="Slide draft not found")
    return SlideDraftRead.model_validate(slide)


@router.post("/drafts", response_model=SlideDraftRead, status_code=201)
async def create_draft(
    notebook_id: int,
    payload: SlideDraftCreate,
    session: AsyncSession = Depends(get_db_session),
) -> SlideDraftRead:
    await _get_notebook(session, notebook_id)
    normalized_source_ids = _normalize_source_ids(payload.source_ids)
    if not normalized_source_ids:
        raise HTTPException(status_code=400, detail="source_ids must not be empty")
    await _validate_source_ids(session, notebook_id, normalized_source_ids)
    slide = StudioSlide(
        notebook_id=notebook_id,
        title=payload.title,
        prompt=payload.prompt,
        engine=payload.engine,
        source_ids=normalized_source_ids,
        generation_config=payload.generation_config.model_dump() if payload.generation_config else None,
        stage=SlideStage.INPUT,
        status=SlideStatus.IDLE,
    )
    session.add(slide)
    await session.commit()
    await session.refresh(slide)
    return SlideDraftRead.model_validate(slide)


@router.get("/drafts/{slide_id}", response_model=SlideDraftRead)
async def get_draft(
    notebook_id: int,
    slide_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> SlideDraftRead:
    slide = await _get_slide(session, notebook_id, slide_id)
    return SlideDraftRead.model_validate(slide)


@router.patch("/drafts/{slide_id}", response_model=SlideDraftRead)
async def update_draft(
    notebook_id: int,
    slide_id: int,
    payload: SlideDraftUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> SlideDraftRead:
    slide = await _get_slide(session, notebook_id, slide_id)
    if payload.title is not None:
        slide.title = payload.title
    if payload.prompt is not None:
        slide.prompt = payload.prompt
    if payload.engine is not None:
        slide.engine = payload.engine
    if payload.source_ids is not None:
        normalized_source_ids = _normalize_source_ids(payload.source_ids)
        if not normalized_source_ids:
            raise HTTPException(status_code=400, detail="source_ids must not be empty")
        await _validate_source_ids(session, notebook_id, normalized_source_ids)
        slide.source_ids = normalized_source_ids
    if payload.generation_config is not None:
        slide.generation_config = payload.generation_config.model_dump()
    slide.error_message = None
    await session.commit()
    await session.refresh(slide)
    return SlideDraftRead.model_validate(slide)


@router.put("/drafts/{slide_id}/outline", response_model=SlideDraftRead)
async def update_outline(
    notebook_id: int,
    slide_id: int,
    payload: SlideOutlineUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> SlideDraftRead:
    slide = await _get_slide(session, notebook_id, slide_id)
    slide.outline = payload.outline.model_dump()
    slide.stage = SlideStage.OUTLINE
    slide.status = SlideStatus.IDLE
    slide.error_message = None
    await session.commit()
    await session.refresh(slide)
    return SlideDraftRead.model_validate(slide)


@router.put("/drafts/{slide_id}/markdown", response_model=SlideDraftRead)
async def update_markdown(
    notebook_id: int,
    slide_id: int,
    payload: SlideMarkdownUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> SlideDraftRead:
    slide = await _get_slide(session, notebook_id, slide_id)
    slide.markdown = payload.markdown
    slide.stage = SlideStage.MARKDOWN
    slide.status = SlideStatus.IDLE
    slide.error_message = None
    await session.commit()
    write_slide_markdown(slide.notebook_id, slide.id, slide.markdown or "")
    write_preview_markdown(slide.markdown or "")
    await _sync_output(session, slide)
    await session.refresh(slide)
    return SlideDraftRead.model_validate(slide)


@router.get("/drafts/{slide_id}/outline/stream")
async def generate_outline_stream(
    notebook_id: int,
    slide_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    settings=Depends(get_settings),
    cache: CacheProvider = Depends(get_cache_provider),
    embedder=Depends(get_embedding_provider),
    vector_store=Depends(get_vector_store),
    model_id: str | None = None,
) -> StreamingResponse:
    slide = await _get_slide(session, notebook_id, slide_id)
    trace_id = new_trace_id()
    request_id = request.headers.get("x-request-id") or request.headers.get("x-correlation-id") or trace_id
    normalized_source_ids = _normalize_source_ids(slide.source_ids)
    if not normalized_source_ids:
        raise HTTPException(status_code=400, detail="source_ids must not be empty")
    await _validate_source_ids(session, notebook_id, normalized_source_ids)

    async def event_stream() -> AsyncGenerator[str, None]:
        if slide.status == SlideStatus.RUNNING:
            stale_cleared = await _clear_stale_running_status(session, slide)
            if not stale_cleared:
                yield _sse_event("busy", {"message": "演示正在生成中，请稍后重试。"})
                return

        slide.status = SlideStatus.RUNNING
        slide.error_message = None
        await session.commit()

        overall_started = perf_counter()
        timings_ms: dict[str, int] = {}

        deps = StudioDeps(
            settings=settings,
            session=session,
            vector_store=vector_store,
            embedder=embedder,
            cache=cache,
        )

        yield _sse_event("progress", {"trace_id": trace_id, "stage": "outline", "message": "开始生成大纲", "progress": 5})
        yield _sse_event("toolcall", {"trace_id": trace_id, "name": "slides_generate_outline"})

        try:
            outline, resolved_chunk_ids = await generate_slides_outline(
                deps,
                notebook_id=notebook_id,
                title=slide.title,
                prompt=slide.prompt,
                source_ids=normalized_source_ids,
                generation_config=slide.generation_config,
                model_id=model_id,
                trace_id=trace_id,
                request_id=request_id,
                timings_ms=timings_ms,
            )
            persist_started = perf_counter()
            slide.outline = outline.model_dump()
            slide.stage = SlideStage.OUTLINE
            slide.status = SlideStatus.IDLE
            slide.chunk_ids = resolved_chunk_ids
            await session.commit()
            await session.refresh(slide)
            timings_ms["persist_ms"] = int((perf_counter() - persist_started) * 1000)
            timings_ms["total_ms"] = int((perf_counter() - overall_started) * 1000)

            yield _sse_event("progress", {"trace_id": trace_id, "stage": "outline", "message": "大纲生成完成", "progress": 100})
            done_payload = {"trace_id": trace_id, "slide_id": slide.id}
            if _env_bool(SSE_TIMINGS_ENV, False):
                done_payload["timings_ms"] = timings_ms
            yield _sse_event("done", done_payload)
        except asyncio.CancelledError:
            if slide.status == SlideStatus.RUNNING:
                slide.status = SlideStatus.IDLE
                slide.error_message = "Generation cancelled."
                await asyncio.shield(session.commit())
            log.info("slide generation cancelled", trace_id=trace_id, request_id=request_id, slide_id=slide.id, stage="outline")
            raise
        except ModelConfigurationError as exc:
            slide.status = SlideStatus.ERROR
            slide.error_message = str(exc)[:500]
            await session.commit()
            yield _sse_event("error", {"trace_id": trace_id, "message": "AI 模型配置错误，请检查配置。"})
        except Exception as exc:  # noqa: BLE001
            slide.status = SlideStatus.ERROR
            slide.error_message = str(exc)[:500]
            await session.commit()
            yield _sse_event("error", {"trace_id": trace_id, "message": "生成大纲失败，请稍后重试。"})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/drafts/{slide_id}/markdown/stream")
async def generate_markdown_stream(
    notebook_id: int,
    slide_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    settings=Depends(get_settings),
    cache: CacheProvider = Depends(get_cache_provider),
    embedder=Depends(get_embedding_provider),
    vector_store=Depends(get_vector_store),
    model_id: str | None = None,
) -> StreamingResponse:
    slide = await _get_slide(session, notebook_id, slide_id)
    trace_id = new_trace_id()
    request_id = request.headers.get("x-request-id") or request.headers.get("x-correlation-id") or trace_id
    normalized_source_ids = _normalize_source_ids(slide.source_ids)
    if not normalized_source_ids:
        raise HTTPException(status_code=400, detail="source_ids must not be empty")
    await _validate_source_ids(session, notebook_id, normalized_source_ids)

    async def event_stream() -> AsyncGenerator[str, None]:
        if slide.status == SlideStatus.RUNNING:
            stale_cleared = await _clear_stale_running_status(session, slide)
            if not stale_cleared:
                yield _sse_event("busy", {"message": "演示正在生成中，请稍后重试。"})
                return
        if not slide.outline:
            yield _sse_event("error", {"message": "尚未生成大纲，无法生成 Markdown。"})
            return

        slide.status = SlideStatus.RUNNING
        slide.error_message = None
        await session.commit()

        overall_started = perf_counter()
        timings_ms: dict[str, int] = {}

        deps = StudioDeps(
            settings=settings,
            session=session,
            vector_store=vector_store,
            embedder=embedder,
            cache=cache,
        )

        outline = SlideOutline.model_validate(slide.outline)

        yield _sse_event("progress", {"trace_id": trace_id, "stage": "markdown", "message": "开始生成 Markdown", "progress": 10})
        yield _sse_event("toolcall", {"trace_id": trace_id, "name": "slides_generate_markdown"})

        try:
            markdown, resolved_chunk_ids = await generate_slides_markdown(
                deps,
                notebook_id=notebook_id,
                title=slide.title,
                prompt=slide.prompt,
                outline=outline,
                source_ids=normalized_source_ids,
                chunk_ids=slide.chunk_ids,
                generation_config=slide.generation_config,
                model_id=model_id,
                trace_id=trace_id,
                request_id=request_id,
                timings_ms=timings_ms,
            )
            persist_started = perf_counter()
            slide.markdown = markdown
            slide.stage = SlideStage.MARKDOWN
            slide.status = SlideStatus.IDLE
            slide.chunk_ids = resolved_chunk_ids
            await session.commit()
            write_slide_markdown(slide.notebook_id, slide.id, slide.markdown or "")
            write_preview_markdown(slide.markdown or "")
            await _sync_output(session, slide)
            await session.refresh(slide)
            timings_ms["persist_ms"] = int((perf_counter() - persist_started) * 1000)
            timings_ms["total_ms"] = int((perf_counter() - overall_started) * 1000)

            yield _sse_event("progress", {"trace_id": trace_id, "stage": "markdown", "message": "Markdown 生成完成", "progress": 100})
            done_payload = {"trace_id": trace_id, "slide_id": slide.id}
            if _env_bool(SSE_TIMINGS_ENV, False):
                done_payload["timings_ms"] = timings_ms
            yield _sse_event("done", done_payload)
        except asyncio.CancelledError:
            if slide.status == SlideStatus.RUNNING:
                slide.status = SlideStatus.IDLE
                slide.error_message = "Generation cancelled."
                await asyncio.shield(session.commit())
            log.info("slide generation cancelled", trace_id=trace_id, request_id=request_id, slide_id=slide.id, stage="markdown")
            raise
        except ModelConfigurationError as exc:
            slide.status = SlideStatus.ERROR
            slide.error_message = str(exc)[:500]
            await session.commit()
            yield _sse_event("error", {"trace_id": trace_id, "message": "AI 模型配置错误，请检查配置。"})
        except Exception as exc:  # noqa: BLE001
            slide.status = SlideStatus.ERROR
            slide.error_message = str(exc)[:500]
            await session.commit()
            yield _sse_event("error", {"trace_id": trace_id, "message": "生成 Markdown 失败，请稍后重试。"})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
