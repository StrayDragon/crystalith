from __future__ import annotations

import asyncio
import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.db import Chunk, Notebook, Output, Source
from crystalith.outputs import OutputType, create_output_generator
from crystalith.vector_storage import VectorSearchResult, VectorStore

from .deps import get_chat_provider, get_db_session, get_embedding_provider, get_vector_store


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/outputs", tags=["outputs"])


class OutputCreateRequest(BaseModel):
    type: OutputType | None = None
    types: list[OutputType] | None = None
    prompt: str | None = None
    chunk_ids: list[int] | None = None
    top_k: int = Field(5, ge=1, le=20)
    min_score: float = Field(0.2, ge=0.0, le=1.0)

    @field_validator("type", mode="before")
    @classmethod
    def _normalize_type(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip().upper()
        return value

    @field_validator("types", mode="before")
    @classmethod
    def _normalize_types(cls, value: Any) -> Any:
        if isinstance(value, list):
            return [item.strip().upper() if isinstance(item, str) else item for item in value]
        return value

    @field_validator("prompt")
    @classmethod
    def _normalize_prompt(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.strip().split())
        return cleaned or None


class OutputCitation(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_id: int
    source_name: str
    chunk_id: int
    chunk_index: int
    page_number: int | None
    paragraph_index: int | None
    snippet: str
    score: float


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


class OutputBatchResponse(BaseModel):
    outputs: list[OutputRead]


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


def _build_citation(chunk: Chunk, source: Source, score: float) -> OutputCitation:
    snippet = chunk.text.strip()[:200]
    return OutputCitation(
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
    citation_map: dict[int, OutputCitation],
    fallback: list[OutputCitation],
) -> list[dict[str, Any]]:
    resolved: list[OutputCitation] = []
    for index in indices:
        citation = citation_map.get(index)
        if citation is not None:
            resolved.append(citation)
    if not resolved and fallback:
        resolved = fallback[:1]
    return [item.model_dump() for item in resolved]


def _map_citations(
    payload: Any,
    citation_map: dict[int, OutputCitation],
    fallback: list[OutputCitation],
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
    payload: OutputCreateRequest,
    session: AsyncSession,
    embedder: EmbeddingProvider,
    vector_store: VectorStore,
) -> tuple[str, list[OutputCitation], list[int]]:
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

        citations = [_build_citation(chunk_map[chunk_id][0], chunk_map[chunk_id][1], 1.0) for chunk_id in explicit_chunk_ids]
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

    citations: list[OutputCitation] = []
    for result in results:
        chunk, source = chunk_map[result.entry.chunk_id]
        citations.append(_build_citation(chunk, source, result.score))

    context = _format_context(results, chunk_map)
    return context, citations, chunk_ids


def _resolve_types(payload: OutputCreateRequest) -> list[OutputType]:
    if payload.types:
        return list(dict.fromkeys(payload.types))
    if payload.type:
        return [payload.type]
    raise HTTPException(status_code=400, detail="type or types is required")


@router.post("", response_model=OutputBatchResponse, status_code=status.HTTP_201_CREATED)
async def create_outputs(
    notebook_id: int,
    payload: OutputCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    chatter: ChatProvider = Depends(get_chat_provider),
    vector_store: VectorStore = Depends(get_vector_store),
) -> OutputBatchResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    output_types = _resolve_types(payload)
    context, citations, resolved_chunk_ids = await _resolve_context(
        notebook_id=notebook_id,
        payload=payload,
        session=session,
        embedder=embedder,
        vector_store=vector_store,
    )
    if not citations:
        return OutputBatchResponse(outputs=[])

    citation_map = {index: citation for index, citation in enumerate(citations, start=1)}
    fallback_citations = citations[:1]

    async def _generate_output(output_type: OutputType) -> tuple[OutputType, dict[str, Any]]:
        generator = create_output_generator(output_type, chatter)
        content = await generator.generate(context=context, prompt=payload.prompt or "")
        mapped = _map_citations(content, citation_map, fallback_citations)
        return output_type, mapped

    results = await asyncio.gather(*[_generate_output(output_type) for output_type in output_types])
    outputs: list[Output] = []
    for output_type, content in results:
        db_output = Output(
            notebook_id=notebook_id,
            type=output_type,
            prompt=payload.prompt,
            chunk_ids=resolved_chunk_ids or None,
            content=content,
        )
        session.add(db_output)
        outputs.append(db_output)

    await session.commit()
    for db_output in outputs:
        await session.refresh(db_output)

    return OutputBatchResponse(outputs=[OutputRead.model_validate(item) for item in outputs])


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
