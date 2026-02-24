from __future__ import annotations

import asyncio
import datetime
import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.shared.cache import CacheProvider
from crystalith.shared.config import Settings
from crystalith.shared.db import Notebook, Session
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
        created_at = datetime.datetime.now(datetime.UTC)
        await persist_qa_messages(
            session,
            db_session=result.db_session,
            history_messages=result.history_messages,
            question=payload.question,
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
            context=ContextStatsResponse.model_validate(result.context_stats),
        )

    async with limiters.llm_generate.acquire():
        answer = await chatter.chat(result.messages)
    answer = _ensure_inline_citations(answer, result.citations)
    created_at = datetime.datetime.now(datetime.UTC)
    await persist_qa_messages(
        session,
        db_session=result.db_session,
        history_messages=result.history_messages,
        question=payload.question,
        answer=answer,
        citations=result.citations,
        created_at=created_at,
    )
    return QAResponse(
        answer=answer,
        citations=result.citations,
        evidence=True,
        confidence=result.confidence,
        created_at=created_at,
        context=ContextStatsResponse.model_validate(result.context_stats),
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
            created_at = datetime.datetime.now(datetime.UTC)
            await persist_qa_messages(
                session,
                db_session=result.db_session,
                history_messages=result.history_messages,
                question=payload.question,
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
                    context=ContextStatsResponse.model_validate(result.context_stats),
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
        created_at = datetime.datetime.now(datetime.UTC)
        await persist_qa_messages(
            session,
            db_session=result.db_session,
            history_messages=result.history_messages,
            question=payload.question,
            answer=answer,
            citations=result.citations,
            created_at=created_at,
        )
        yield _sse_event(
            "done",
            QAStreamDoneData(
                citations=result.citations,
                evidence=True,
                confidence=result.confidence,
                created_at=created_at,
                context=ContextStatsResponse.model_validate(result.context_stats),
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
