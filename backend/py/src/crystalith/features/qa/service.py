from __future__ import annotations

import asyncio
import datetime
from dataclasses import dataclass
from typing import cast

import sqlalchemy as sa
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import EmbeddingProvider
from crystalith.shared.ai.types import ChatMessage, ChatRole
from crystalith.shared.cache import CacheProvider
from crystalith.shared.chat_ui_envelope import strip_ui_envelope
from crystalith.shared.config import Settings
from crystalith.shared.concurrency import StageLimiters
from crystalith.shared.context import ContextStats, ContextWindow, TokenCounter
from crystalith.shared.db import Chunk, Message, Session, Source
from crystalith.shared.schemas.citations import Citation
from crystalith.shared.types import SourceStatus
from crystalith.shared.utils import extract_page_number, extract_paragraph_index, format_context
from crystalith.shared.vector_storage import VectorSearchResult, VectorStore, cached_vector_search


EVIDENCE_THRESHOLD_DEFAULT = 0.2
NO_EVIDENCE_ANSWER = "来源中未找到相关证据"
SYSTEM_PROMPT = (
    "You are a research assistant. Answer ONLY using the provided sources. "
    f"If the sources are insufficient, reply with: {NO_EVIDENCE_ANSWER}. "
    "Use inline citations like [1], [2] for every sourced statement. "
    "Do NOT use any external knowledge."
)


@dataclass(frozen=True, slots=True)
class QAPipelineResult:
    db_session: Session | None
    history_messages: list[ChatMessage]
    messages: list[ChatMessage]
    citations: list[Citation]
    evidence: bool
    confidence: float
    context_stats: ContextStats


def generate_session_title(question: str) -> str:
    cleaned = " ".join(question.strip().split())
    if not cleaned:
        return "New session"
    return cleaned[:80]


def confidence_score(
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


def normalize_source_ids(source_ids: list[int] | None) -> list[int]:
    if not source_ids:
        return []
    normalized = [int(value) for value in source_ids]
    if any(value <= 0 for value in normalized):
        raise HTTPException(status_code=400, detail="Unknown source_id in source_ids")
    # Deduplicate while preserving order.
    return list(dict.fromkeys(normalized))


async def validate_source_ids(
    session: AsyncSession,
    *,
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


async def load_session_history(
    session: AsyncSession,
    *,
    notebook_id: int,
    session_id: int | None,
) -> tuple[Session | None, list[ChatMessage]]:
    if session_id is None:
        return None, []
    db_session = await session.get(Session, session_id)
    if db_session is None or db_session.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Session not found")
    history_rows = await session.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    history_messages: list[ChatMessage] = []
    for message in history_rows.scalars().all():
        role = message.role
        if role not in {"system", "user", "assistant"}:
            role = "user"
        content = strip_ui_envelope(message.content) if role == "assistant" else message.content
        history_messages.append(ChatMessage(role=cast(ChatRole, role), content=content))
    return db_session, history_messages


async def persist_qa_messages(
    session: AsyncSession,
    *,
    db_session: Session | None,
    history_messages: list[ChatMessage],
    question: str,
    answer: str,
    citations: list[Citation],
    created_at: datetime.datetime,
) -> None:
    if db_session is None:
        return
    if not history_messages and not db_session.title:
        db_session.title = generate_session_title(question)
    db_session.updated_at = created_at
    session.add(
        Message(
            session_id=db_session.id,
            role="user",
            content=question,
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


def build_context_window(
    *,
    settings: Settings,
    history_messages: list[ChatMessage],
    question: str,
    context: str,
) -> tuple[list[ChatMessage], ContextStats]:
    system_message = ChatMessage(role="system", content=SYSTEM_PROMPT)
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


async def run_qa_pipeline(
    *,
    session: AsyncSession,
    settings: Settings,
    notebook_id: int,
    question: str,
    source_ids: list[int] | None,
    top_k: int,
    min_score: float,
    session_id: int | None,
    embedder: EmbeddingProvider,
    vector_store: VectorStore,
    cache: CacheProvider,
    limiters: StageLimiters,
    source_ids_validated: bool = False,
) -> QAPipelineResult:
    normalized_source_ids = normalize_source_ids(source_ids)

    if normalized_source_ids and not source_ids_validated:
        await validate_source_ids(session, notebook_id=notebook_id, source_ids=normalized_source_ids)

    if not normalized_source_ids:
        db_session, history_messages = await load_session_history(
            session,
            notebook_id=notebook_id,
            session_id=session_id,
        )
        messages, stats = build_context_window(
            settings=settings,
            history_messages=history_messages,
            question=question,
            context="",
        )
        return QAPipelineResult(
            db_session=db_session,
            history_messages=history_messages,
            messages=messages,
            citations=[],
            evidence=False,
            confidence=0.0,
            context_stats=stats,
        )

    if session_id is None:
        async with limiters.embedding.acquire():
            embeddings = await embedder.embed_batch([question])
        db_session = None
        history_messages: list[ChatMessage] = []
    else:
        async def _embed_question() -> list[list[float]]:
            async with limiters.embedding.acquire():
                return await embedder.embed_batch([question])

        embeddings, history_payload = await asyncio.gather(
            _embed_question(),
            load_session_history(session, notebook_id=notebook_id, session_id=session_id),
        )
        db_session, history_messages = history_payload

    if not embeddings:
        messages, stats = build_context_window(
            settings=settings,
            history_messages=history_messages,
            question=question,
            context="",
        )
        return QAPipelineResult(
            db_session=db_session,
            history_messages=history_messages,
            messages=messages,
            citations=[],
            evidence=False,
            confidence=0.0,
            context_stats=stats,
        )

    query_vector = embeddings[0]
    async with limiters.vector_search.acquire():
        results = await cached_vector_search(
            cache=cache,
            vector_store=vector_store,
            notebook_id=notebook_id,
            query_vector=query_vector,
            top_k=top_k,
            min_score=min_score,
            source_ids=normalized_source_ids,
        )

    if not results:
        messages, stats = build_context_window(
            settings=settings,
            history_messages=history_messages,
            question=question,
            context="",
        )
        return QAPipelineResult(
            db_session=db_session,
            history_messages=history_messages,
            messages=messages,
            citations=[],
            evidence=False,
            confidence=0.0,
            context_stats=stats,
        )

    chunk_ids = [result.entry.chunk_id for result in results]
    rows = await session.execute(
        select(Chunk, Source)
        .join(Source, Source.id == Chunk.source_id)
        .where(Chunk.id.in_(chunk_ids))
    )

    chunk_map: dict[int, tuple[Chunk, Source]] = {chunk.id: (chunk, source) for chunk, source in rows.all()}

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
        messages, stats = build_context_window(
            settings=settings,
            history_messages=history_messages,
            question=question,
            context="",
        )
        return QAPipelineResult(
            db_session=db_session,
            history_messages=history_messages,
            messages=messages,
            citations=[],
            evidence=False,
            confidence=0.0,
            context_stats=stats,
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
                chunk_index=chunk.chunk_index + 1,
                page_number=extract_page_number(chunk),
                paragraph_index=extract_paragraph_index(chunk),
                snippet=snippet,
                score=result.score,
            )
        )

    context = format_context(valid_results, chunk_map)
    messages, stats = build_context_window(
        settings=settings,
        history_messages=history_messages,
        question=question,
        context=context,
    )

    evidence_threshold = max(min_score, EVIDENCE_THRESHOLD_DEFAULT)
    similarity_avg = sum(result.score for result in valid_results) / len(valid_results)
    if similarity_avg < evidence_threshold:
        return QAPipelineResult(
            db_session=db_session,
            history_messages=history_messages,
            messages=messages,
            citations=[],
            evidence=False,
            confidence=0.0,
            context_stats=stats,
        )

    total_sources = await session.scalar(
        select(sa.func.count(Source.id)).where(Source.notebook_id == notebook_id)
    )
    total_sources = total_sources or 0
    unique_sources = len({citation.source_id for citation in citations})
    coverage_ratio = unique_sources / total_sources if total_sources else 0.0
    citation_ratio = min(1.0, len(citations) / top_k)
    confidence = confidence_score(
        similarity_avg=similarity_avg,
        coverage_ratio=coverage_ratio,
        citation_ratio=citation_ratio,
    )

    return QAPipelineResult(
        db_session=db_session,
        history_messages=history_messages,
        messages=messages,
        citations=citations,
        evidence=True,
        confidence=confidence,
        context_stats=stats,
    )
