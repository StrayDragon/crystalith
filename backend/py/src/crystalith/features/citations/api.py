from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Chunk, Source
from crystalith.shared.deps import get_db_session
from crystalith.shared.schemas.citations import Citation
from crystalith.shared.utils import extract_page_number, extract_paragraph_index


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/citations", tags=["citations"])


class CitationContextChunk(BaseModel):
    chunk_id: int
    chunk_index: int
    text: str
    page_number: int | None = None
    paragraph_index: int | None = None


class CitationContextResponse(BaseModel):
    citation: Citation
    before: list[CitationContextChunk]
    chunk: CitationContextChunk
    after: list[CitationContextChunk]


def _to_context_chunk(chunk: Chunk) -> CitationContextChunk:
    return CitationContextChunk(
        chunk_id=chunk.id,
        chunk_index=chunk.chunk_index + 1,
        text=chunk.text,
        page_number=extract_page_number(chunk),
        paragraph_index=extract_paragraph_index(chunk),
    )


def _to_citation(chunk: Chunk, source: Source) -> Citation:
    snippet = chunk.text.strip()[:200]
    return Citation(
        source_id=source.id,
        source_name=source.filename,
        chunk_id=chunk.id,
        chunk_index=chunk.chunk_index + 1,
        page_number=extract_page_number(chunk),
        paragraph_index=extract_paragraph_index(chunk),
        snippet=snippet,
        score=None,
    )


@router.get("/context", response_model=CitationContextResponse)
async def get_citation_context(
    notebook_id: int,
    chunk_id: int | None = Query(None, ge=1),
    source_id: int | None = Query(None, ge=1),
    chunk_index: int | None = Query(None, ge=1, description="1-based chunk index within the source"),
    before: int = Query(1, ge=0, le=5, description="How many chunks to include before the cited chunk"),
    after: int = Query(1, ge=0, le=5, description="How many chunks to include after the cited chunk"),
    session: AsyncSession = Depends(get_db_session),
) -> CitationContextResponse:
    """Fetch citation context for evidence review.

    Provide either `chunk_id` OR (`source_id` + `chunk_index`).
    Returned `chunk_index` values are 1-based.
    """
    has_chunk_id = chunk_id is not None
    has_source_locator = source_id is not None or chunk_index is not None

    if has_chunk_id and has_source_locator:
        raise HTTPException(status_code=400, detail="Provide either chunk_id or source_id+chunk_index (not both)")
    if not has_chunk_id and not (source_id is not None and chunk_index is not None):
        raise HTTPException(status_code=400, detail="Provide chunk_id or source_id+chunk_index")

    if has_chunk_id:
        result = await session.execute(
            select(Chunk, Source)
            .join(Source, Source.id == Chunk.source_id)
            .where(Chunk.id == chunk_id, Source.notebook_id == notebook_id)
        )
    else:
        resolved_index = (chunk_index or 1) - 1
        result = await session.execute(
            select(Chunk, Source)
            .join(Source, Source.id == Chunk.source_id)
            .where(
                Chunk.source_id == source_id,
                Chunk.chunk_index == resolved_index,
                Source.notebook_id == notebook_id,
            )
        )

    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Chunk not found")

    chunk, source = row

    lower = max(0, chunk.chunk_index - before)
    upper = chunk.chunk_index + after
    window_rows = await session.execute(
        select(Chunk)
        .where(
            Chunk.source_id == source.id,
            Chunk.chunk_index >= lower,
            Chunk.chunk_index <= upper,
        )
        .order_by(Chunk.chunk_index.asc())
    )
    window_chunks = list(window_rows.scalars().all())

    before_chunks: list[CitationContextChunk] = []
    after_chunks: list[CitationContextChunk] = []
    current_chunk = _to_context_chunk(chunk)

    for item in window_chunks:
        if item.id == chunk.id:
            current_chunk = _to_context_chunk(item)
            continue
        if item.chunk_index < chunk.chunk_index:
            before_chunks.append(_to_context_chunk(item))
        else:
            after_chunks.append(_to_context_chunk(item))

    return CitationContextResponse(
        citation=_to_citation(chunk, source),
        before=before_chunks,
        chunk=current_chunk,
        after=after_chunks,
    )
