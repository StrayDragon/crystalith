from __future__ import annotations

import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.db import Chunk, Notebook, Output, Source
from crystalith.outputs import OutputType, create_output_generator
from crystalith.schemas.citations import Citation
from crystalith.vector_storage import VectorSearchResult, VectorStore

from .deps import get_chat_provider, get_db_session, get_embedding_provider, get_vector_store


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/outputs", tags=["outputs"])


class OutputGenerateRequest(BaseModel):
    prompt: str | None = None
    chunk_ids: list[int] | None = None
    top_k: int = Field(5, ge=1, le=20)
    min_score: float = Field(0.2, ge=0.0, le=1.0)

    @field_validator("prompt")
    @classmethod
    def _normalize_prompt(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.strip().split())
        return cleaned or None


class OutputRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    type: OutputType
    prompt: str | None
    chunk_ids: list[int] | None
    content: dict[str, Any]
    created_at: datetime.datetime
    updated_at: datetime.datetime


def _format_context(results: list[VectorSearchResult], chunk_map: dict[int, tuple[Chunk, Source]]) -> str:
    blocks: list[str] = []
    for index, result in enumerate(results, start=1):
        chunk, source = chunk_map[result.entry.chunk_id]
        blocks.append(
            f"[{index}] Source: {source.filename} (chunk {chunk.chunk_index})\n{chunk.text}"
        )
    return "\n\n".join(blocks)


def _format_context_from_chunk_ids(
    chunk_ids: list[int],
    chunk_map: dict[int, tuple[Chunk, Source]],
) -> str:
    blocks: list[str] = []
    for index, chunk_id in enumerate(chunk_ids, start=1):
        chunk, source = chunk_map[chunk_id]
        blocks.append(
            f"[{index}] Source: {source.filename} (chunk {chunk.chunk_index})\n{chunk.text}"
        )
    return "\n\n".join(blocks)


def _extract_page_number(chunk: Chunk) -> int | None:
    metadata = chunk.metadata_ if isinstance(chunk.metadata_, dict) else None
    page = metadata.get("page") if metadata else None
    return page if isinstance(page, int) else None


def _extract_paragraph_index(chunk: Chunk) -> int | None:
    metadata = chunk.metadata_ if isinstance(chunk.metadata_, dict) else None
    paragraph_index = metadata.get("paragraph_index") if metadata else None
    return paragraph_index if isinstance(paragraph_index, int) else None


def _build_citation(chunk: Chunk, source: Source, score: float) -> Citation:
    snippet = chunk.text.strip()[:200]
    return Citation(
        source_id=source.id,
        source_name=source.filename,
        chunk_id=chunk.id,
        chunk_index=chunk.chunk_index,
        page_number=_extract_page_number(chunk),
        paragraph_index=_extract_paragraph_index(chunk),
        snippet=snippet,
        score=score,
    )


def _resolve_citation_indices(value: Any) -> list[int]:
    if not isinstance(value, list):
        return []
    indices: list[int] = []
    for item in value:
        try:
            index = int(item)
        except (TypeError, ValueError):
            continue
        if index > 0:
            indices.append(index)
    return indices


def _resolve_citations(
    indices: list[int],
    citation_map: dict[int, Citation],
    fallback: list[Citation],
) -> list[dict[str, Any]]:
    resolved: list[Citation] = []
    for index in indices:
        citation = citation_map.get(index)
        if citation is not None:
            resolved.append(citation)
    if not resolved and fallback:
        resolved = fallback[:1]
    return [item.model_dump() for item in resolved]


def _map_citations(
    payload: Any,
    citation_map: dict[int, Citation],
    fallback: list[Citation],
) -> Any:
    if isinstance(payload, dict):
        mapped: dict[str, Any] = {}
        for key, value in payload.items():
            if key == "citations":
                indices = _resolve_citation_indices(value)
                mapped[key] = _resolve_citations(indices, citation_map, fallback)
            else:
                mapped[key] = _map_citations(value, citation_map, fallback)
        return mapped
    if isinstance(payload, list):
        return [_map_citations(item, citation_map, fallback) for item in payload]
    return payload


async def _resolve_context(
    *,
    notebook_id: int,
    payload: OutputGenerateRequest,
    session: AsyncSession,
    embedder: EmbeddingProvider,
    vector_store: VectorStore,
) -> tuple[str, list[Citation], list[int]]:
    explicit_chunk_ids = [int(value) for value in (payload.chunk_ids or []) if int(value) > 0]
    if explicit_chunk_ids:
        rows = await session.execute(
            select(Chunk, Source)
            .join(Source, Source.id == Chunk.source_id)
            .where(Chunk.id.in_(explicit_chunk_ids), Source.notebook_id == notebook_id)
        )
        chunk_map: dict[int, tuple[Chunk, Source]] = {
            chunk.id: (chunk, source) for chunk, source in rows.all()
        }
        missing = [chunk_id for chunk_id in explicit_chunk_ids if chunk_id not in chunk_map]
        if missing:
            raise HTTPException(status_code=400, detail="Unknown chunk_id in chunk_ids")

        citations = [
            _build_citation(chunk_map[chunk_id][0], chunk_map[chunk_id][1], 1.0)
            for chunk_id in explicit_chunk_ids
        ]
        context = _format_context_from_chunk_ids(explicit_chunk_ids, chunk_map)
        return context, citations, explicit_chunk_ids

    seed = payload.prompt or "Summarize the notebook sources."
    embeddings = await embedder.embed([seed])
    if not embeddings:
        return "", [], []
    query_vector = embeddings[0]
    results = await vector_store.search(
        notebook_id=notebook_id,
        query_vector=query_vector,
        top_k=payload.top_k,
        min_score=payload.min_score,
    )
    if not results:
        return "", [], []

    chunk_ids = [result.entry.chunk_id for result in results]
    rows = await session.execute(
        select(Chunk, Source)
        .join(Source, Source.id == Chunk.source_id)
        .where(Chunk.id.in_(chunk_ids))
    )
    chunk_map = {chunk.id: (chunk, source) for chunk, source in rows.all()}

    citations: list[Citation] = []
    for result in results:
        chunk, source = chunk_map[result.entry.chunk_id]
        citations.append(_build_citation(chunk, source, result.score))

    context = _format_context(results, chunk_map)
    return context, citations, chunk_ids


@router.post("/{output_type}", response_model=OutputRead, status_code=status.HTTP_201_CREATED)
async def create_output(
    notebook_id: int,
    output_type: OutputType,
    payload: OutputGenerateRequest,
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    chatter: ChatProvider = Depends(get_chat_provider),
    vector_store: VectorStore = Depends(get_vector_store),
) -> OutputRead:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    context, citations, resolved_chunk_ids = await _resolve_context(
        notebook_id=notebook_id,
        payload=payload,
        session=session,
        embedder=embedder,
        vector_store=vector_store,
    )

    citation_map = {index: citation for index, citation in enumerate(citations, start=1)}
    fallback_citations = citations[:1]
    generator = create_output_generator(output_type, chatter)
    content = await generator.generate(context=context, prompt=payload.prompt or "")
    mapped = _map_citations(content, citation_map, fallback_citations)

    db_output = Output(
        notebook_id=notebook_id,
        type=output_type,
        prompt=payload.prompt,
        chunk_ids=resolved_chunk_ids or None,
        content=mapped,
    )
    session.add(db_output)
    await session.commit()
    await session.refresh(db_output)

    return OutputRead.model_validate(db_output)


@router.get("", response_model=list[OutputRead])
async def list_outputs(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[OutputRead]:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    result = await session.execute(
        select(Output)
        .where(Output.notebook_id == notebook_id)
        .order_by(Output.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [OutputRead.model_validate(item) for item in result.scalars().all()]
