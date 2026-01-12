from __future__ import annotations

import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from crystalith.ai.interfaces import EmbeddingProvider
from crystalith.db import Chunk, Notebook, Source, SourceStatus
from crystalith.ingestion import chunk_text
from crystalith.vector_index import InMemoryVectorIndex

from .deps import get_db_session, get_embedding_provider, get_vector_index


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/sources", tags=["sources"])

SUPPORTED_EXTENSIONS = {".txt", ".md", ".markdown"}
SUPPORTED_MIME_TYPES = {"text/plain", "text/markdown"}


class SourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    filename: str
    mime_type: str | None
    status: SourceStatus
    error_message: str | None
    chunk_count: int = 0
    created_at: datetime.datetime
    updated_at: datetime.datetime


def _ensure_supported_file(file: UploadFile) -> None:
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    if extension in SUPPORTED_EXTENSIONS:
        return
    if file.content_type in SUPPORTED_MIME_TYPES:
        return
    raise HTTPException(status_code=415, detail="Only txt/markdown files are supported")


def _source_to_read(source: Source, *, chunk_count: int) -> SourceRead:
    return SourceRead.model_validate(source).model_copy(update={"chunk_count": chunk_count})


@router.get("", response_model=list[SourceRead])
async def list_sources(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> list[SourceRead]:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    result = await session.execute(
        select(Source)
        .where(Source.notebook_id == notebook_id)
        .order_by(Source.created_at.desc())
        .options(selectinload(Source.chunks))
    )
    sources = result.scalars().all()
    return [_source_to_read(source, chunk_count=len(source.chunks)) for source in sources]


@router.post("", response_model=SourceRead, status_code=status.HTTP_201_CREATED)
async def upload_source(
    notebook_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    vector_index: InMemoryVectorIndex = Depends(get_vector_index),
) -> SourceRead:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    _ensure_supported_file(file)
    filename = file.filename or "upload.txt"
    mime_type = file.content_type

    source = Source(
        notebook_id=notebook_id,
        filename=filename,
        mime_type=mime_type,
        status=SourceStatus.PROCESSING,
    )
    session.add(source)
    await session.flush()

    try:
        raw = await file.read()
        text = raw.decode("utf-8")
        chunks = chunk_text(text)
        if not chunks:
            raise ValueError("empty document")

        embeddings = await embedder.embed([chunk.text for chunk in chunks])
        if len(embeddings) != len(chunks):
            raise ValueError("embedding count mismatch")

        chunk_models: list[Chunk] = []
        for index, chunk in enumerate(chunks):
            chunk_model = Chunk(
                source_id=source.id,
                chunk_index=index,
                text=chunk.text,
                start_offset=chunk.start_offset,
                end_offset=chunk.end_offset,
            )
            session.add(chunk_model)
            chunk_models.append(chunk_model)

        await session.flush()
        chunk_ids = [chunk.id for chunk in chunk_models]

        source.status = SourceStatus.READY
        source.error_message = None
        await session.commit()
        await session.refresh(source)

        vector_index.add(
            notebook_id=notebook_id,
            source_id=source.id,
            chunk_ids=chunk_ids,
            vectors=embeddings,
        )
    except Exception as exc:
        await session.rollback()
        source.status = SourceStatus.FAILED
        source.error_message = str(exc)[:512]
        session.add(source)
        await session.commit()
        raise HTTPException(status_code=500, detail="Ingestion failed") from exc

    return _source_to_read(source, chunk_count=len(chunk_ids))


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(
    notebook_id: int,
    source_id: int,
    session: AsyncSession = Depends(get_db_session),
    vector_index: InMemoryVectorIndex = Depends(get_vector_index),
) -> None:
    source = await session.get(Source, source_id)
    if source is None or source.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Source not found")

    await session.delete(source)
    await session.commit()
    vector_index.remove_source(source_id)
