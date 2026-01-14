from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.ai.types import ChatMessage
from crystalith.db import Chunk, Notebook, Source
from crystalith.vector_index import InMemoryVectorIndex, VectorSearchResult

from .deps import get_chat_provider, get_db_session, get_embedding_provider, get_vector_index


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/qa", tags=["qa"])


class QARequest(BaseModel):
    question: str = Field(..., min_length=1)
    top_k: int = Field(5, ge=1, le=20)
    min_score: float = Field(0.2, ge=0.0, le=1.0)


class QACitation(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_id: int
    source_name: str
    chunk_id: int
    chunk_index: int
    snippet: str
    score: float


class QAResponse(BaseModel):
    answer: str
    citations: list[QACitation]
    evidence: bool
    created_at: datetime.datetime


def _format_context(results: list[VectorSearchResult], chunk_map: dict[int, tuple[Chunk, Source]]) -> str:
    blocks: list[str] = []
    for index, result in enumerate(results, start=1):
        chunk, source = chunk_map[result.entry.chunk_id]
        blocks.append(
            f"[{index}] Source: {source.filename} (chunk {chunk.chunk_index})\n{chunk.text}"
        )
    return "\n\n".join(blocks)


@router.post("", response_model=QAResponse)
async def ask_question(
    notebook_id: int,
    payload: QARequest,
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    chatter: ChatProvider = Depends(get_chat_provider),
    vector_index: InMemoryVectorIndex = Depends(get_vector_index),
) -> QAResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    embeddings = await embedder.embed([payload.question])
    if not embeddings:
        return QAResponse(
            answer="Insufficient evidence in notebook sources.",
            citations=[],
            evidence=False,
            created_at=datetime.datetime.now(datetime.UTC),
        )
    query_vector = embeddings[0]
    results = vector_index.search(
        notebook_id=notebook_id,
        query_vector=query_vector,
        top_k=payload.top_k,
        min_score=payload.min_score,
    )

    if not results:
        return QAResponse(
            answer="Insufficient evidence in notebook sources.",
            citations=[],
            evidence=False,
            created_at=datetime.datetime.now(datetime.UTC),
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

    citations: list[QACitation] = []
    for result in results:
        chunk, source = chunk_map[result.entry.chunk_id]
        snippet = chunk.text.strip()[:200]
        citations.append(
            QACitation(
                source_id=source.id,
                source_name=source.filename,
                chunk_id=chunk.id,
                chunk_index=chunk.chunk_index,
                snippet=snippet,
                score=result.score,
            )
        )

    context = _format_context(results, chunk_map)
    messages = [
        ChatMessage(
            role="system",
            content=(
                "You are a research assistant. Answer strictly using the provided sources. "
                "If the sources are insufficient, say so."
            ),
        ),
        ChatMessage(
            role="user",
            content=f"Question:\n{payload.question}\n\nSources:\n{context}",
        ),
    ]

    answer = await chatter.chat(messages)
    return QAResponse(
        answer=answer,
        citations=citations,
        evidence=True,
        created_at=datetime.datetime.now(datetime.UTC),
    )
