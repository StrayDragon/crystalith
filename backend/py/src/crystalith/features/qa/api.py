from __future__ import annotations

import datetime
import json
import asyncio
from collections.abc import AsyncGenerator

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.shared.ai.types import ChatMessage
from crystalith.shared.config import Settings
from crystalith.shared.context import ContextStats, ContextWindow, TokenCounter
from crystalith.shared.db import Chunk, Message, Notebook, Session, Source
from crystalith.shared.schemas.citations import Citation
from crystalith.shared.types import SourceStatus
from crystalith.shared.utils import extract_page_number, extract_paragraph_index, format_context
from crystalith.shared.vector_storage import VectorSearchResult, VectorStore

from crystalith.shared.deps import (
    get_ai_provider,
    get_db_session,
    get_embedding_provider,
    get_settings,
    get_vector_store,
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


EVIDENCE_THRESHOLD_DEFAULT = 0.2
NO_EVIDENCE_ANSWER = "来源中未找到相关证据"
SYSTEM_PROMPT = (
    "You are a research assistant. Answer ONLY using the provided sources. "
    f"If the sources are insufficient, reply with: {NO_EVIDENCE_ANSWER}. "
    "Use inline citations like [1], [2] for every sourced statement. "
    "Do NOT use any external knowledge."
)


def _generate_session_title(question: str) -> str:
    cleaned = " ".join(question.strip().split())
    if not cleaned:
        return "New session"
    return cleaned[:80]


def _confidence_score(
    *,
    similarity_avg: float,
    coverage_ratio: float,
    citation_ratio: float,
) -> float:
    score = (similarity_avg + coverage_ratio + citation_ratio) / 3.0
    if score < 0.0:
        return 0.0
    if score > 1.0:
        return 1.0
    return score


def _ensure_inline_citations(answer: str, citations: list[Citation]) -> str:
    if not citations:
        return answer
    if "[" in answer and "]" in answer:
        return answer
    return f"{answer} [1]"


def _normalize_source_ids(source_ids: list[int] | None) -> list[int]:
    if not source_ids:
        return []
    normalized = [int(value) for value in source_ids]
    if any(value <= 0 for value in normalized):
        raise HTTPException(status_code=400, detail="Unknown source_id in source_ids")
    # Deduplicate while preserving order
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


@router.post("", response_model=QAResponse)
async def ask_question(
    notebook_id: int,
    payload: QARequest,
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    chatter: ChatProvider = Depends(get_ai_provider),
    vector_store: VectorStore = Depends(get_vector_store),
    settings: Settings = Depends(get_settings),
) -> QAResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    async def _load_history() -> tuple[Session | None, list[ChatMessage]]:
        if payload.session_id is None:
            return None, []
        db_session = await session.get(Session, payload.session_id)
        if db_session is None or db_session.notebook_id != notebook_id:
            raise HTTPException(status_code=404, detail="Session not found")
        history_rows = await session.execute(
            select(Message)
            .where(Message.session_id == payload.session_id)
            .order_by(Message.created_at.asc())
        )
        history_messages = [
            ChatMessage(role=message.role, content=message.content)
            for message in history_rows.scalars().all()
        ]
        return db_session, history_messages

    db_session: Session | None = None
    history_messages: list[ChatMessage] = []

    async def _persist_session_messages(
        answer: str,
        citations: list[Citation],
        created_at: datetime.datetime,
    ) -> None:
        if db_session is None:
            return
        if not history_messages and not db_session.title:
            db_session.title = _generate_session_title(payload.question)
        db_session.updated_at = created_at
        session.add(
            Message(
                session_id=db_session.id,
                role="user",
                content=payload.question,
                citations=None,
            )
        )
        session.add(
            Message(
                session_id=db_session.id,
                role="assistant",
                content=answer,
                citations=[citation.model_dump() for citation in citations],
            )
        )
        await session.commit()

    source_ids = _normalize_source_ids(payload.source_ids)
    if not source_ids:
        if payload.session_id is not None:
            db_session, history_messages = await _load_history()
        created_at = datetime.datetime.now(datetime.UTC)
        _, stats = _build_context_window(
            settings=settings,
            history_messages=history_messages,
            question=payload.question,
            context="",
        )
        await _persist_session_messages(
            answer=NO_EVIDENCE_ANSWER,
            citations=[],
            created_at=created_at,
        )
        return QAResponse(
            answer=NO_EVIDENCE_ANSWER,
            citations=[],
            evidence=False,
            confidence=0.0,
            created_at=created_at,
            context=ContextStatsResponse.model_validate(stats),
        )

    await _validate_source_ids(session, notebook_id, source_ids)

    if payload.session_id is None:
        embeddings = await embedder.embed_batch([payload.question])
        db_session = None
        history_messages = []
    else:
        embedding_task = embedder.embed_batch([payload.question])
        history_task = _load_history()
        embeddings, history_payload = await asyncio.gather(embedding_task, history_task)
        db_session, history_messages = history_payload
    if not embeddings:
        created_at = datetime.datetime.now(datetime.UTC)
        _, stats = _build_context_window(
            settings=settings,
            history_messages=history_messages,
            question=payload.question,
            context="",
        )
        await _persist_session_messages(
            answer=NO_EVIDENCE_ANSWER,
            citations=[],
            created_at=created_at,
        )
        return QAResponse(
            answer=NO_EVIDENCE_ANSWER,
            citations=[],
            evidence=False,
            confidence=0.0,
            created_at=created_at,
            context=ContextStatsResponse.model_validate(stats),
        )
    query_vector = embeddings[0]
    results = await vector_store.search(
        notebook_id=notebook_id,
        query_vector=query_vector,
        top_k=payload.top_k,
        min_score=payload.min_score,
        source_ids=source_ids,
    )

    if not results:
        created_at = datetime.datetime.now(datetime.UTC)
        _, stats = _build_context_window(
            settings=settings,
            history_messages=history_messages,
            question=payload.question,
            context="",
        )
        await _persist_session_messages(
            answer=NO_EVIDENCE_ANSWER,
            citations=[],
            created_at=created_at,
        )
        return QAResponse(
            answer=NO_EVIDENCE_ANSWER,
            citations=[],
            evidence=False,
            confidence=0.0,
            created_at=created_at,
            context=ContextStatsResponse.model_validate(stats),
        )

    chunk_ids = [result.entry.chunk_id for result in results]
    rows = await session.execute(
        select(Chunk, Source)
        .join(Source, Source.id == Chunk.source_id)
        .where(Chunk.id.in_(chunk_ids))
    )

    chunk_map: dict[int, tuple[Chunk, Source]] = {
        chunk.id: (chunk, source) for chunk, source in rows.all()
    }

    valid_results: list[VectorSearchResult] = []
    for result in results:
        mapping = chunk_map.get(result.entry.chunk_id)
        if mapping is None:
            continue
        chunk, source = mapping
        if source.status != SourceStatus.READY:
            continue
        if chunk.source_id != source.id or result.entry.source_id != source.id:
            continue
        if not chunk.text.strip():
            continue
        valid_results.append(result)

    if not valid_results:
        created_at = datetime.datetime.now(datetime.UTC)
        _, stats = _build_context_window(
            settings=settings,
            history_messages=history_messages,
            question=payload.question,
            context="",
        )
        await _persist_session_messages(
            answer=NO_EVIDENCE_ANSWER,
            citations=[],
            created_at=created_at,
        )
        return QAResponse(
            answer=NO_EVIDENCE_ANSWER,
            citations=[],
            evidence=False,
            confidence=0.0,
            created_at=created_at,
            context=ContextStatsResponse.model_validate(stats),
        )

    citations: list[Citation] = []
    for result in valid_results:
        chunk, source = chunk_map[result.entry.chunk_id]
        snippet = chunk.text.strip()[:200]
        citations.append(
            Citation(
                source_id=source.id,
                source_name=source.filename,
                chunk_id=chunk.id,
                chunk_index=chunk.chunk_index,
                page_number=extract_page_number(chunk),
                paragraph_index=extract_paragraph_index(chunk),
                snippet=snippet,
                score=result.score,
            )
        )

    context = format_context(valid_results, chunk_map)
    messages, stats = _build_context_window(
        settings=settings,
        history_messages=history_messages,
        question=payload.question,
        context=context,
    )

    evidence_threshold = max(payload.min_score, EVIDENCE_THRESHOLD_DEFAULT)
    similarity_avg = sum(result.score for result in valid_results) / len(valid_results)
    if similarity_avg < evidence_threshold:
        created_at = datetime.datetime.now(datetime.UTC)
        await _persist_session_messages(
            answer=NO_EVIDENCE_ANSWER,
            citations=[],
            created_at=created_at,
        )
        return QAResponse(
            answer=NO_EVIDENCE_ANSWER,
            citations=[],
            evidence=False,
            confidence=0.0,
            created_at=created_at,
            context=ContextStatsResponse.model_validate(stats),
        )

    total_sources = await session.scalar(
        select(sa.func.count(Source.id)).where(Source.notebook_id == notebook_id)
    )
    total_sources = total_sources or 0
    unique_sources = len({citation.source_id for citation in citations})
    coverage_ratio = unique_sources / total_sources if total_sources else 0.0
    citation_ratio = min(1.0, len(citations) / payload.top_k)
    confidence = _confidence_score(
        similarity_avg=similarity_avg,
        coverage_ratio=coverage_ratio,
        citation_ratio=citation_ratio,
    )

    answer = await chatter.chat(messages)
    answer = _ensure_inline_citations(answer, citations)
    created_at = datetime.datetime.now(datetime.UTC)
    await _persist_session_messages(answer=answer, citations=citations, created_at=created_at)
    return QAResponse(
        answer=answer,
        citations=citations,
        evidence=True,
        confidence=confidence,
        created_at=created_at,
        context=ContextStatsResponse.model_validate(stats),
    )


def _build_context_window(
    *,
    settings: Settings,
    history_messages: list[ChatMessage],
    question: str,
    context: str,
) -> tuple[list[ChatMessage], ContextStats]:
    system_message = ChatMessage(role="system", content=SYSTEM_PROMPT)
    # Get model name from default chat model
    default_chat = settings.get_default_chat_model()
    model_name = default_chat.model if default_chat else "gpt-4"
    counter = TokenCounter(model_name)
    window = ContextWindow(settings.context_window, counter)
    return window.build(
        system_message=system_message,
        history_messages=history_messages,
        query=question,
        retrieval=context,
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
    settings: Settings = Depends(get_settings),
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

    async def _load_history() -> tuple[Session | None, list[ChatMessage]]:
        if payload.session_id is None:
            return None, []
        db_session = await session.get(Session, payload.session_id)
        if db_session is None or db_session.notebook_id != notebook_id:
            raise HTTPException(status_code=404, detail="Session not found")
        history_rows = await session.execute(
            select(Message)
            .where(Message.session_id == payload.session_id)
            .order_by(Message.created_at.asc())
        )
        history_messages = [
            ChatMessage(role=message.role, content=message.content)
            for message in history_rows.scalars().all()
        ]
        return db_session, history_messages

    db_session: Session | None = None
    history_messages: list[ChatMessage] = []

    async def _persist_session_messages_stream(
        answer: str,
        citations: list[Citation],
        created_at: datetime.datetime,
    ) -> None:
        if db_session is None:
            return
        if not history_messages and not db_session.title:
            db_session.title = _generate_session_title(payload.question)
        db_session.updated_at = created_at
        session.add(
            Message(
                session_id=db_session.id,
                role="user",
                content=payload.question,
                citations=None,
            )
        )
        session.add(
            Message(
                session_id=db_session.id,
                role="assistant",
                content=answer,
                citations=[citation.model_dump() for citation in citations],
            )
        )
        await session.commit()

    source_ids = _normalize_source_ids(payload.source_ids)
    if source_ids:
        await _validate_source_ids(session, notebook_id, source_ids)

    async def generate_stream() -> AsyncGenerator[str, None]:
        nonlocal db_session
        nonlocal history_messages

        if not source_ids:
            if await request.is_disconnected():
                return
            if payload.session_id is not None and db_session is None:
                db_session, history_messages = await _load_history()
            created_at = datetime.datetime.now(datetime.UTC)
            _, stats = _build_context_window(
                settings=settings,
                history_messages=history_messages,
                question=payload.question,
                context="",
            )
            await _persist_session_messages_stream(
                answer=NO_EVIDENCE_ANSWER,
                citations=[],
                created_at=created_at,
            )
            yield _sse_event("chunk", {"text": NO_EVIDENCE_ANSWER})
            yield _sse_event(
                "done",
                QAStreamDoneData(
                    citations=[],
                    evidence=False,
                    confidence=0.0,
                    created_at=created_at,
                    context=ContextStatsResponse.model_validate(stats),
                ).model_dump(mode="json"),
            )
            return

        # Embed the question
        try:
            if await request.is_disconnected():
                return
            if payload.session_id is None:
                embeddings = await embedder.embed_batch([payload.question])
            else:
                embeddings, history_payload = await asyncio.gather(
                    embedder.embed_batch([payload.question]),
                    _load_history(),
                )
                db_session, history_messages = history_payload
        except Exception as embed_error:
            # Handle embedding service errors (e.g., Ollama 503)
            error_msg = f"Embedding 服务暂时不可用: {embed_error}"
            yield _sse_event("error", {"message": error_msg})
            return

        if not embeddings:
            created_at = datetime.datetime.now(datetime.UTC)
            _, stats = _build_context_window(
                settings=settings,
                history_messages=history_messages,
                question=payload.question,
                context="",
            )
            await _persist_session_messages_stream(
                answer=NO_EVIDENCE_ANSWER,
                citations=[],
                created_at=created_at,
            )
            yield _sse_event("chunk", {"text": NO_EVIDENCE_ANSWER})
            yield _sse_event(
                "done",
                QAStreamDoneData(
                    citations=[],
                    evidence=False,
                    confidence=0.0,
                    created_at=created_at,
                    context=ContextStatsResponse.model_validate(stats),
                ).model_dump(mode="json"),
            )
            return

        query_vector = embeddings[0]
        if await request.is_disconnected():
            return
        results = await vector_store.search(
            notebook_id=notebook_id,
            query_vector=query_vector,
            top_k=payload.top_k,
            min_score=payload.min_score,
            source_ids=source_ids,
        )

        if not results:
            created_at = datetime.datetime.now(datetime.UTC)
            _, stats = _build_context_window(
                settings=settings,
                history_messages=history_messages,
                question=payload.question,
                context="",
            )
            await _persist_session_messages_stream(
                answer=NO_EVIDENCE_ANSWER,
                citations=[],
                created_at=created_at,
            )
            yield _sse_event("chunk", {"text": NO_EVIDENCE_ANSWER})
            yield _sse_event(
                "done",
                QAStreamDoneData(
                    citations=[],
                    evidence=False,
                    confidence=0.0,
                    created_at=created_at,
                    context=ContextStatsResponse.model_validate(stats),
                ).model_dump(mode="json"),
            )
            return

        chunk_ids = [result.entry.chunk_id for result in results]
        rows = await session.execute(
            select(Chunk, Source)
            .join(Source, Source.id == Chunk.source_id)
            .where(Chunk.id.in_(chunk_ids))
        )

        chunk_map: dict[int, tuple[Chunk, Source]] = {
            chunk.id: (chunk, source) for chunk, source in rows.all()
        }

        valid_results: list[VectorSearchResult] = []
        for result in results:
            mapping = chunk_map.get(result.entry.chunk_id)
            if mapping is None:
                continue
            chunk, source = mapping
            if source.status != SourceStatus.READY:
                continue
            if chunk.source_id != source.id or result.entry.source_id != source.id:
                continue
            if not chunk.text.strip():
                continue
            valid_results.append(result)

        if not valid_results:
            created_at = datetime.datetime.now(datetime.UTC)
            _, stats = _build_context_window(
                settings=settings,
                history_messages=history_messages,
                question=payload.question,
                context="",
            )
            await _persist_session_messages_stream(
                answer=NO_EVIDENCE_ANSWER,
                citations=[],
                created_at=created_at,
            )
            yield _sse_event("chunk", {"text": NO_EVIDENCE_ANSWER})
            yield _sse_event(
                "done",
                QAStreamDoneData(
                    citations=[],
                    evidence=False,
                    confidence=0.0,
                    created_at=created_at,
                    context=ContextStatsResponse.model_validate(stats),
                ).model_dump(mode="json"),
            )
            return

        citations: list[Citation] = []
        for result in valid_results:
            chunk, source = chunk_map[result.entry.chunk_id]
            snippet = chunk.text.strip()[:200]
            citations.append(
                Citation(
                    source_id=source.id,
                    source_name=source.filename,
                    chunk_id=chunk.id,
                    chunk_index=chunk.chunk_index,
                    page_number=extract_page_number(chunk),
                    paragraph_index=extract_paragraph_index(chunk),
                    snippet=snippet,
                    score=result.score,
                )
            )

        context = format_context(valid_results, chunk_map)
        messages, stats = _build_context_window(
            settings=settings,
            history_messages=history_messages,
            question=payload.question,
            context=context,
        )

        evidence_threshold = max(payload.min_score, EVIDENCE_THRESHOLD_DEFAULT)
        similarity_avg = sum(result.score for result in valid_results) / len(valid_results)
        if similarity_avg < evidence_threshold:
            created_at = datetime.datetime.now(datetime.UTC)
            await _persist_session_messages_stream(
                answer=NO_EVIDENCE_ANSWER,
                citations=[],
                created_at=created_at,
            )
            yield _sse_event("chunk", {"text": NO_EVIDENCE_ANSWER})
            yield _sse_event(
                "done",
                QAStreamDoneData(
                    citations=[],
                    evidence=False,
                    confidence=0.0,
                    created_at=created_at,
                    context=ContextStatsResponse.model_validate(stats),
                ).model_dump(mode="json"),
            )
            return

        total_sources = await session.scalar(
            select(sa.func.count(Source.id)).where(Source.notebook_id == notebook_id)
        )
        total_sources = total_sources or 0
        unique_sources = len({citation.source_id for citation in citations})
        coverage_ratio = unique_sources / total_sources if total_sources else 0.0
        citation_ratio = min(1.0, len(citations) / payload.top_k)
        confidence = _confidence_score(
            similarity_avg=similarity_avg,
            coverage_ratio=coverage_ratio,
            citation_ratio=citation_ratio,
        )

        # Stream the answer
        answer_chunks: list[str] = []
        try:
            async for chunk in chatter.chat_stream(messages):
                if await request.is_disconnected():
                    return
                answer_chunks.append(chunk)
                yield _sse_event("chunk", {"text": chunk})
        except Exception as e:  # noqa: BLE001
            yield _sse_event("error", {"message": str(e)})
            return

        if await request.is_disconnected():
            return

        answer = "".join(answer_chunks)
        answer = _ensure_inline_citations(answer, citations)
        created_at = datetime.datetime.now(datetime.UTC)
        await _persist_session_messages_stream(answer=answer, citations=citations, created_at=created_at)

        yield _sse_event(
            "done",
            QAStreamDoneData(
                citations=citations,
                evidence=True,
                confidence=confidence,
                created_at=created_at,
                context=ContextStatsResponse.model_validate(stats),
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
