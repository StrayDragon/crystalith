from __future__ import annotations

import asyncio
import datetime
import json
from collections.abc import AsyncGenerator
from typing import Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.shared.ai.types import ChatMessage
from crystalith.shared.cache import CacheProvider
from crystalith.shared.config import Settings
from crystalith.shared.db import Message, Notebook, Session, Source
from crystalith.shared.deps import (
    get_ai_provider,
    get_cache_provider,
    get_db_session,
    get_embedding_provider,
    get_settings,
    get_stage_limiters,
    get_vector_store,
)
from crystalith.shared.schemas.citations import Citation
from crystalith.shared.vector_storage import VectorStore

from ..prompt_presets.service import list_all_presets as list_all_prompt_presets
from ..prompt_presets.service import resolve_preset as resolve_prompt_preset
from .presets import parse_prompt_directive, parse_stats_preset_output
from .service import (
    QAPipelineResult,
    create_provisional_assistant_message,
    delete_provisional_assistant_message,
    finalize_provisional_assistant_message,
    no_evidence_answer_for_reason,
    normalize_source_ids,
    persist_qa_messages,
    run_qa_pipeline,
    validate_source_ids,
)

router = APIRouter(prefix="/v1/notebooks/{notebook_id}/qa", tags=["qa"])


class QARequest(BaseModel):
    question: str = Field(..., min_length=1)
    source_ids: list[int] | None = None
    top_k: int = Field(5, ge=1, le=20)
    min_score: float = Field(0.2, ge=0.0, le=1.0)
    session_id: int | None = None


class ContextStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_tokens: int
    system_tokens: int
    history_tokens: int
    retrieval_tokens: int
    query_tokens: int
    max_tokens: int
    compressed: bool


class QAResponse(BaseModel):
    answer: str
    citations: list[Citation]
    evidence: bool
    confidence: float
    created_at: datetime.datetime
    context: ContextStatsResponse
    message_id: int | None


class QAStreamDoneData(BaseModel):
    citations: list[Citation]
    evidence: bool
    confidence: float
    created_at: datetime.datetime
    context: ContextStatsResponse
    message_id: int | None


class QAExportSource(BaseModel):
    source_id: int
    source_name: str
    mime_type: str | None = None
    parser_type: str | None = None


class QAExportJson(BaseModel):
    notebook_id: int
    session_id: int
    message_id: int
    question: str | None
    answer: str
    citations: list[Citation]
    sources: list[QAExportSource]
    exported_at: datetime.datetime


def _ensure_inline_citations(answer: str, citations: list[Citation]) -> str:
    if not citations:
        return answer
    if "[" in answer and "]" in answer:
        return answer
    return f"{answer} [1]"


def _override_system_prompt(messages: list[ChatMessage], system_prompt: str) -> list[ChatMessage]:
    if not messages:
        return []
    updated = list(messages)
    updated[0] = ChatMessage(role="system", content=system_prompt)
    return updated


def _format_prompt_usage(presets: list[str]) -> str:
    normalized = sorted({preset for preset in presets if preset})
    presets_str = ", ".join(normalized)
    return f"Usage: /prompt:<preset> <query>. Available presets: {presets_str}"


async def _prompt_usage(session: AsyncSession) -> str:
    resolved, _custom_rows = await list_all_prompt_presets(session)
    triggers = [preset.trigger for preset in resolved]
    return _format_prompt_usage(triggers)


def _context_stats_from_result(result: QAPipelineResult) -> ContextStatsResponse:
    return ContextStatsResponse.model_validate(result.context_stats)


async def _build_qa_response(
    *,
    session: AsyncSession,
    result: QAPipelineResult,
    question: str,
    answer: str,
    citations: list[Citation],
    evidence: bool,
    confidence: float,
) -> QAResponse:
    created_at = datetime.datetime.now(datetime.UTC)
    assistant_message = await persist_qa_messages(
        session,
        db_session=result.db_session,
        history_messages=result.history_messages,
        question=question,
        answer=answer,
        citations=citations,
        created_at=created_at,
    )
    return QAResponse(
        answer=answer,
        citations=citations,
        evidence=evidence,
        confidence=confidence,
        created_at=created_at,
        context=_context_stats_from_result(result),
        message_id=assistant_message.id if assistant_message is not None else None,
    )


def _sse_event(event: str, data: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _build_done_data(
    *,
    result: QAPipelineResult,
    citations: list[Citation],
    evidence: bool,
    confidence: float,
    created_at: datetime.datetime,
    message_id: int | None,
) -> QAStreamDoneData:
    return QAStreamDoneData(
        citations=citations,
        evidence=evidence,
        confidence=confidence,
        created_at=created_at,
        context=_context_stats_from_result(result),
        message_id=message_id,
    )


async def _single_error_stream(message: str) -> StreamingResponse:
    async def generate() -> AsyncGenerator[str, None]:
        yield _sse_event("error", {"message": message})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("", response_model=QAResponse)
async def ask_question(
    notebook_id: int,
    payload: QARequest,
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    chatter: ChatProvider = Depends(get_ai_provider),
    vector_store: VectorStore = Depends(get_vector_store),
    cache: CacheProvider = Depends(get_cache_provider),
    settings: Settings = Depends(get_settings),
    limiters=Depends(get_stage_limiters),
) -> QAResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    resolved_preset = None
    pipeline_question = payload.question
    try:
        directive = parse_prompt_directive(payload.question)
    except ValueError:
        raise HTTPException(status_code=400, detail=await _prompt_usage(session)) from None

    if directive is not None:
        if not settings.app.features.chat_prompt_presets_enabled:
            raise HTTPException(status_code=400, detail="Prompt presets are disabled")
        if not directive.query:
            raise HTTPException(status_code=400, detail=await _prompt_usage(session))
        resolved_preset = await resolve_prompt_preset(session, directive.preset)
        if resolved_preset is None:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown preset: {directive.preset}. {await _prompt_usage(session)}",
            )
        if not resolved_preset.enabled:
            raise HTTPException(status_code=400, detail="Prompt preset is disabled")
        pipeline_question = directive.query

    normalized_source_ids = normalize_source_ids(payload.source_ids)
    if normalized_source_ids:
        await validate_source_ids(session, notebook_id=notebook_id, source_ids=normalized_source_ids)

    if payload.session_id is not None:
        db_session = await session.get(Session, payload.session_id)
        if db_session is None or db_session.notebook_id != notebook_id:
            raise HTTPException(status_code=404, detail="Session not found")

    result = await run_qa_pipeline(
        session=session,
        settings=settings,
        notebook_id=notebook_id,
        question=pipeline_question,
        source_ids=normalized_source_ids,
        top_k=payload.top_k,
        min_score=payload.min_score,
        session_id=payload.session_id,
        embedder=embedder,
        vector_store=vector_store,
        cache=cache,
        limiters=limiters,
        source_ids_validated=True,
    )

    if not result.evidence:
        no_evidence_answer = no_evidence_answer_for_reason(result.no_evidence_reason)
        return await _build_qa_response(
            session=session,
            result=result,
            question=payload.question,
            answer=no_evidence_answer,
            citations=[],
            evidence=False,
            confidence=0.0,
        )

    messages_for_llm = (
        _override_system_prompt(result.messages, resolved_preset.system_prompt)
        if resolved_preset is not None
        else result.messages
    )

    if resolved_preset is not None and resolved_preset.trigger == "stats" and resolved_preset.source == "builtin":
        async with limiters.llm_generate.acquire():
            raw = await chatter.chat(messages_for_llm)
        parsed = parse_stats_preset_output(raw)
        if parsed is not None:
            answer = _ensure_inline_citations(parsed.fallback_markdown, result.citations)
            return await _build_qa_response(
                session=session,
                result=result,
                question=payload.question,
                answer=answer,
                citations=result.citations,
                evidence=True,
                confidence=result.confidence,
            )
        messages_for_llm = result.messages

    async with limiters.llm_generate.acquire():
        answer = await chatter.chat(messages_for_llm)
    answer = _ensure_inline_citations(answer, result.citations)
    return await _build_qa_response(
        session=session,
        result=result,
        question=payload.question,
        answer=answer,
        citations=result.citations,
        evidence=True,
        confidence=result.confidence,
    )


@router.post(
    "/stream",
    responses={
        200: {
            "description": "SSE stream of QA response",
            "content": {"text/event-stream": {}},
        }
    },
)
async def ask_question_stream(
    notebook_id: int,
    payload: QARequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    chatter: ChatProvider = Depends(get_ai_provider),
    vector_store: VectorStore = Depends(get_vector_store),
    cache: CacheProvider = Depends(get_cache_provider),
    settings: Settings = Depends(get_settings),
    limiters=Depends(get_stage_limiters),
) -> StreamingResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    async def generate_stream() -> AsyncGenerator[str, None]:
        if await request.is_disconnected():
            return

        resolved_preset = None
        pipeline_question = payload.question
        result: QAPipelineResult | None = None
        assistant_message: Message | None = None
        completed = False

        try:
            try:
                directive = parse_prompt_directive(payload.question)
            except ValueError:
                yield _sse_event("error", {"message": await _prompt_usage(session)})
                return

            if directive is not None:
                if not settings.app.features.chat_prompt_presets_enabled:
                    yield _sse_event("error", {"message": "Prompt presets are disabled"})
                    return
                if not directive.query:
                    yield _sse_event("error", {"message": await _prompt_usage(session)})
                    return
                resolved_preset = await resolve_prompt_preset(session, directive.preset)
                if resolved_preset is None:
                    yield _sse_event(
                        "error",
                        {"message": f"Unknown preset: {directive.preset}. {await _prompt_usage(session)}"},
                    )
                    return
                if not resolved_preset.enabled:
                    yield _sse_event("error", {"message": "Prompt preset is disabled"})
                    return
                pipeline_question = directive.query

            normalized_source_ids = normalize_source_ids(payload.source_ids)
            if normalized_source_ids:
                await validate_source_ids(session, notebook_id=notebook_id, source_ids=normalized_source_ids)

            result = await run_qa_pipeline(
                session=session,
                settings=settings,
                notebook_id=notebook_id,
                question=pipeline_question,
                source_ids=normalized_source_ids,
                top_k=payload.top_k,
                min_score=payload.min_score,
                session_id=payload.session_id,
                embedder=embedder,
                vector_store=vector_store,
                cache=cache,
                limiters=limiters,
                source_ids_validated=True,
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            yield _sse_event("error", {"message": f"Embedding 服务暂时不可用: {exc}"})
            return

        try:
            if result.db_session is not None:
                assistant_message = await create_provisional_assistant_message(
                    session,
                    db_session=result.db_session,
                    history_messages=result.history_messages,
                    question=payload.question,
                    created_at=datetime.datetime.now(datetime.UTC),
                )
            yield _sse_event("state_snapshot", {
                "message_id": assistant_message.id if assistant_message is not None else None,
            })

            if not result.evidence:
                if await request.is_disconnected():
                    return
                no_evidence_answer = no_evidence_answer_for_reason(result.no_evidence_reason)
                yield _sse_event("chunk", {"text": no_evidence_answer})
                created_at = datetime.datetime.now(datetime.UTC)
                if result.db_session is not None and assistant_message is not None:
                    await finalize_provisional_assistant_message(
                        session,
                        db_session=result.db_session,
                        assistant_message_id=assistant_message.id,
                        answer=no_evidence_answer,
                        citations=[],
                        created_at=created_at,
                    )
                yield _sse_event(
                    "done",
                    cast(
                        dict[str, object],
                        _build_done_data(
                            result=result,
                            citations=[],
                            evidence=False,
                            confidence=0.0,
                            created_at=created_at,
                            message_id=assistant_message.id if assistant_message is not None else None,
                        ).model_dump(mode="json"),
                    ),
                )
                completed = True
                return

            messages_for_llm = (
                _override_system_prompt(result.messages, resolved_preset.system_prompt)
                if resolved_preset is not None
                else result.messages
            )

            if resolved_preset is not None and resolved_preset.trigger == "stats" and resolved_preset.source == "builtin":
                try:
                    async with limiters.llm_generate.acquire():
                        raw = await chatter.chat(messages_for_llm)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    yield _sse_event("error", {"message": str(exc)})
                    return

                parsed = parse_stats_preset_output(raw)
                if parsed is not None:
                    if await request.is_disconnected():
                        return
                    answer = _ensure_inline_citations(parsed.fallback_markdown, result.citations)
                    chunk_size = 240
                    for idx in range(0, len(answer), chunk_size):
                        if await request.is_disconnected():
                            return
                        yield _sse_event("chunk", {"text": answer[idx : idx + chunk_size]})

                    created_at = datetime.datetime.now(datetime.UTC)
                    if result.db_session is not None and assistant_message is not None:
                        await finalize_provisional_assistant_message(
                            session,
                            db_session=result.db_session,
                            assistant_message_id=assistant_message.id,
                            answer=answer,
                            citations=result.citations,
                            created_at=created_at,
                        )

                    yield _sse_event(
                        "done",
                        cast(
                            dict[str, object],
                            _build_done_data(
                                result=result,
                                citations=result.citations,
                                evidence=True,
                                confidence=result.confidence,
                                created_at=created_at,
                                message_id=assistant_message.id if assistant_message is not None else None,
                            ).model_dump(mode="json"),
                        ),
                    )
                    completed = True
                    return
                messages_for_llm = result.messages

            answer_chunks: list[str] = []
            try:
                async with limiters.llm_generate.acquire():
                    async for chunk in chatter.chat_stream(messages_for_llm):
                        if await request.is_disconnected():
                            return
                        answer_chunks.append(chunk)
                        yield _sse_event("chunk", {"text": chunk})
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                yield _sse_event("error", {"message": str(exc)})
                return

            if await request.is_disconnected():
                return

            answer = _ensure_inline_citations("".join(answer_chunks), result.citations)
            created_at = datetime.datetime.now(datetime.UTC)
            if result.db_session is not None and assistant_message is not None:
                await finalize_provisional_assistant_message(
                    session,
                    db_session=result.db_session,
                    assistant_message_id=assistant_message.id,
                    answer=answer,
                    citations=result.citations,
                    created_at=created_at,
                )
            yield _sse_event(
                "done",
                cast(
                    dict[str, object],
                    _build_done_data(
                        result=result,
                        citations=result.citations,
                        evidence=True,
                        confidence=result.confidence,
                        created_at=created_at,
                        message_id=assistant_message.id if assistant_message is not None else None,
                    ).model_dump(mode="json"),
                ),
            )
            completed = True
        finally:
            if not completed and result is not None and result.db_session is not None and assistant_message is not None:
                await delete_provisional_assistant_message(
                    session,
                    db_session=result.db_session,
                    assistant_message_id=assistant_message.id,
                    created_at=datetime.datetime.now(datetime.UTC),
                )

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _build_sources_meta(
    *,
    sources: list[Source],
    fallback_names: dict[int, str],
) -> list[QAExportSource]:
    items = [
        QAExportSource(
            source_id=source.id,
            source_name=source.filename or fallback_names.get(source.id) or "未知来源",
            mime_type=source.mime_type,
            parser_type=source.parser_type,
        )
        for source in sources
    ]
    missing = [source_id for source_id in fallback_names if source_id not in {s.id for s in sources}]
    items.extend(
        [
            QAExportSource(
                source_id=source_id,
                source_name=fallback_names.get(source_id) or "未知来源",
                mime_type=None,
                parser_type=None,
            )
            for source_id in sorted(missing)
        ]
    )
    return items


def _format_citation_line(index: int, citation: Citation) -> str:
    parts = [f"[{index}] {citation.source_name}"]
    parts.append(f"chunk {citation.chunk_index}")
    if citation.page_number is not None:
        parts.append(f"page {citation.page_number}")
    if citation.paragraph_index is not None:
        parts.append(f"para {citation.paragraph_index}")
    prefix = " · ".join(parts)
    snippet = citation.snippet.strip()
    if snippet:
        return f"{prefix}\n> {snippet}"
    return prefix


@router.get("/export", response_model=QAExportJson)
async def export_qa(
    notebook_id: int,
    session_id: int = Query(..., ge=1),
    message_id: int | None = Query(None, ge=1, description="Assistant message ID to export; defaults to latest"),
    export_format: Literal["markdown", "json"] = Query("markdown", alias="format"),
    session: AsyncSession = Depends(get_db_session),
) -> object:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    db_session = await session.get(Session, session_id)
    if db_session is None or db_session.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Session not found")

    assistant_message: Message | None
    if message_id is not None:
        message = await session.get(Message, message_id)
        if message is None or message.session_id != session_id:
            raise HTTPException(status_code=404, detail="Message not found")
        if message.role != "assistant":
            raise HTTPException(status_code=400, detail="message_id must refer to an assistant message")
        assistant_message = message
    else:
        result = await session.execute(
            select(Message)
            .where(Message.session_id == session_id, Message.role == "assistant")
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        assistant_message = result.scalars().first()

    if assistant_message is None:
        raise HTTPException(status_code=404, detail="No assistant message found to export")

    answer_text = assistant_message.content

    question_result = await session.execute(
        select(Message)
        .where(
            Message.session_id == session_id,
            Message.role == "user",
            Message.created_at <= assistant_message.created_at,
        )
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    question_message = question_result.scalars().first()
    question = question_message.content if question_message is not None else None

    raw_citations = assistant_message.citations or []
    citations = [Citation.model_validate(item) for item in raw_citations]

    source_ids = list(dict.fromkeys([citation.source_id for citation in citations if citation.source_id]))
    source_rows = await session.execute(
        select(Source).where(Source.notebook_id == notebook_id, Source.id.in_(source_ids))
    )
    sources = list(source_rows.scalars().all())

    fallback_names = {citation.source_id: citation.source_name for citation in citations}
    sources_meta = _build_sources_meta(sources=sources, fallback_names=fallback_names)

    exported_at = datetime.datetime.now(datetime.UTC)
    if export_format == "json":
        return QAExportJson(
            notebook_id=notebook_id,
            session_id=session_id,
            message_id=assistant_message.id,
            question=question,
            answer=answer_text,
            citations=citations,
            sources=sources_meta,
            exported_at=exported_at,
        )

    citation_lines = [
        _format_citation_line(index, citation)
        for index, citation in enumerate(citations, start=1)
    ]
    citations_block = "\n\n".join(citation_lines) if citation_lines else "无引用"
    markdown = [
        f"# QA Export #{assistant_message.id}",
        "",
        f"- Notebook ID: {notebook_id}",
        f"- Session ID: {session_id}",
        f"- Message ID: {assistant_message.id}",
        f"- Exported At: {exported_at.isoformat()}",
        "",
        "## Question",
        question or "(unknown)",
        "",
        "## Answer",
        answer_text,
        "",
        "## Citations",
        citations_block,
    ]
    return Response(
        content="\n".join(markdown),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="qa-export-{assistant_message.id}.md"',
        },
    )
