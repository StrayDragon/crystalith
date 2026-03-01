from __future__ import annotations

import asyncio
import datetime
import json
from collections.abc import AsyncGenerator
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.shared.cache import CacheProvider
from crystalith.shared.chat_ui_envelope import strip_ui_envelope
from crystalith.shared.chat_ui_envelope import embed_ui_envelope
from crystalith.shared.config import Settings
from crystalith.shared.db import Message, Notebook, Session, Source
from crystalith.shared.schemas.citations import Citation
from crystalith.shared.vector_storage import VectorStore

from crystalith.shared.deps import (
    get_ai_provider,
    get_cache_provider,
    get_db_session,
    get_embedding_provider,
    get_settings,
    get_stage_limiters,
    get_vector_store,
)

from .service import (
    NO_EVIDENCE_ANSWER,
    QAPipelineResult,
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


def _ensure_inline_citations(answer: str, citations: list[Citation]) -> str:
    if not citations:
        return answer
    if "[" in answer and "]" in answer:
        return answer
    return f"{answer} [1]"


def _build_answer_envelope(*, answer: str) -> dict[str, object]:
    return {
        "schema": "crystalith.ui.message.v1",
        "parts": [
            {
                "type": "component",
                "name": "AnswerCard",
                "id": "answer",
                "props": {"markdown": answer},
            },
            {
                "type": "tool_use",
                "id": "qa_export_markdown_preview",
                "name": "qa_export_markdown_preview",
                "input": {},
                "auto_execute": True,
            },
            {
                "type": "tool_use",
                "id": "qa_export_json_preview",
                "name": "qa_export_json_preview",
                "input": {},
                "requires_confirm": True,
            },
        ],
    }


def _maybe_embed_answer(*, answer: str, settings: Settings, envelope: dict[str, object] | None = None) -> str:
    if not settings.app.features.chat_ui_envelope_enabled:
        return answer
    resolved_envelope = envelope or _build_answer_envelope(answer=answer)
    return embed_ui_envelope(answer, resolved_envelope)


def _context_stats_from_result(result: QAPipelineResult) -> ContextStatsResponse:
    return ContextStatsResponse.model_validate(result.context_stats)


async def _persist_qa_completion(
    *,
    session: AsyncSession,
    result: QAPipelineResult,
    question: str,
    answer: str,
    citations: list[Citation],
) -> datetime.datetime:
    created_at = datetime.datetime.now(datetime.UTC)
    await persist_qa_messages(
        session,
        db_session=result.db_session,
        history_messages=result.history_messages,
        question=question,
        answer=answer,
        citations=citations,
        created_at=created_at,
    )
    return created_at


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
    created_at = await _persist_qa_completion(
        session=session,
        result=result,
        question=question,
        answer=answer,
        citations=citations,
    )
    return QAResponse(
        answer=answer,
        citations=citations,
        evidence=evidence,
        confidence=confidence,
        created_at=created_at,
        context=_context_stats_from_result(result),
    )


def _build_qa_stream_done_data(
    *,
    result: QAPipelineResult,
    citations: list[Citation],
    evidence: bool,
    confidence: float,
    created_at: datetime.datetime,
) -> QAStreamDoneData:
    return QAStreamDoneData(
        citations=citations,
        evidence=evidence,
        confidence=confidence,
        created_at=created_at,
        context=_context_stats_from_result(result),
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

    result = await run_qa_pipeline(
        session=session,
        settings=settings,
        notebook_id=notebook_id,
        question=payload.question,
        source_ids=payload.source_ids,
        top_k=payload.top_k,
        min_score=payload.min_score,
        session_id=payload.session_id,
        embedder=embedder,
        vector_store=vector_store,
        cache=cache,
        limiters=limiters,
    )

    if not result.evidence:
        return await _build_qa_response(
            session=session,
            result=result,
            question=payload.question,
            answer=_maybe_embed_answer(answer=NO_EVIDENCE_ANSWER, settings=settings),
            citations=[],
            evidence=False,
            confidence=0.0,
        )

    async with limiters.llm_generate.acquire():
        answer = await chatter.chat(result.messages)
    answer = _ensure_inline_citations(answer, result.citations)
    return await _build_qa_response(
        session=session,
        result=result,
        question=payload.question,
        answer=_maybe_embed_answer(answer=answer, settings=settings),
        citations=result.citations,
        evidence=True,
        confidence=result.confidence,
    )


# SSE event formatting helpers
def _sse_event(event: str, data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


class QAStreamDoneData(BaseModel):
    """Data sent in the 'done' SSE event."""

    citations: list[Citation]
    evidence: bool
    confidence: float
    created_at: datetime.datetime
    context: ContextStatsResponse


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
    """
    Stream QA response using Server-Sent Events.

    Events:
    - `chunk`: Text chunk `{"text": "..."}`
    - `done`: Completion `{"citations": [...], "evidence": bool, "confidence": float, ...}`
    - `error`: Error `{"message": "..."}`
    """
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    normalized_source_ids = normalize_source_ids(payload.source_ids)
    if normalized_source_ids:
        await validate_source_ids(session, notebook_id=notebook_id, source_ids=normalized_source_ids)

    if payload.session_id is not None:
        db_session = await session.get(Session, payload.session_id)
        if db_session is None or db_session.notebook_id != notebook_id:
            raise HTTPException(status_code=404, detail="Session not found")

    async def generate_stream() -> AsyncGenerator[str, None]:
        if await request.is_disconnected():
            return

        try:
            result = await run_qa_pipeline(
                session=session,
                settings=settings,
                notebook_id=notebook_id,
                question=payload.question,
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
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            yield _sse_event("error", {"message": f"Embedding 服务暂时不可用: {exc}"})
            return

        if not result.evidence:
            if await request.is_disconnected():
                return
            persisted_answer = _maybe_embed_answer(answer=NO_EVIDENCE_ANSWER, settings=settings)
            created_at = await _persist_qa_completion(
                session=session,
                result=result,
                question=payload.question,
                answer=persisted_answer,
                citations=[],
            )
            yield _sse_event("chunk", {"text": NO_EVIDENCE_ANSWER})
            yield _sse_event(
                "done",
                _build_qa_stream_done_data(
                    result=result,
                    citations=[],
                    evidence=False,
                    confidence=0.0,
                    created_at=created_at,
                ).model_dump(mode="json"),
            )
            return

        answer_chunks: list[str] = []
        try:
            async with limiters.llm_generate.acquire():
                async for chunk in chatter.chat_stream(result.messages):
                    if await request.is_disconnected():
                        return
                    answer_chunks.append(chunk)
                    yield _sse_event("chunk", {"text": chunk})
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            yield _sse_event("error", {"message": str(exc)})
            return

        if await request.is_disconnected():
            return

        answer = "".join(answer_chunks)
        answer = _ensure_inline_citations(answer, result.citations)
        persisted_answer = _maybe_embed_answer(answer=answer, settings=settings)
        created_at = await _persist_qa_completion(
            session=session,
            result=result,
            question=payload.question,
            answer=persisted_answer,
            citations=result.citations,
        )
        yield _sse_event(
            "done",
            _build_qa_stream_done_data(
                result=result,
                citations=result.citations,
                evidence=True,
                confidence=result.confidence,
                created_at=created_at,
            ).model_dump(mode="json"),
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


def _build_sources_meta(
    *,
    sources: list[Source],
    fallback_names: dict[int, str],
) -> list[QAExportSource]:
    items: list[QAExportSource] = []
    for source in sources:
        items.append(
            QAExportSource(
                source_id=source.id,
                source_name=source.filename or fallback_names.get(source.id) or "未知来源",
                mime_type=source.mime_type,
                parser_type=source.parser_type,
            )
        )
    missing = [source_id for source_id in fallback_names.keys() if source_id not in {s.id for s in sources}]
    for source_id in sorted(missing):
        items.append(
            QAExportSource(
                source_id=source_id,
                source_name=fallback_names.get(source_id) or "未知来源",
                mime_type=None,
                parser_type=None,
            )
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
    format: Literal["markdown", "json"] = Query("markdown"),
    session: AsyncSession = Depends(get_db_session),
) -> object:
    """Export a QA answer with citations as Markdown or JSON."""
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

    answer_text = strip_ui_envelope(assistant_message.content)

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
    if format == "json":
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

    lines: list[str] = []
    lines.append("# QA Export")
    lines.append("")
    if question:
        lines.append("## Question")
        lines.append("")
        lines.append(question)
        lines.append("")
    lines.append("## Answer")
    lines.append("")
    lines.append(answer_text)
    lines.append("")

    if citations:
        lines.append("## Citations")
        lines.append("")
        for index, citation in enumerate(citations, start=1):
            lines.append(_format_citation_line(index, citation))
            lines.append("")

    if sources_meta:
        lines.append("## Sources")
        lines.append("")
        for item in sources_meta:
            mime = f" ({item.mime_type})" if item.mime_type else ""
            lines.append(f"- {item.source_name}{mime} (id: {item.source_id})")

    filename = f"qa-session-{session_id}-message-{assistant_message.id}.md"
    return Response(
        "\n".join(lines).rstrip() + "\n",
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
