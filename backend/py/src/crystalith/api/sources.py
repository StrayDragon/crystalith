from __future__ import annotations

import datetime
from enum import StrEnum
from time import perf_counter
from typing import Any, Iterable

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from crystalith.ai.interfaces import EmbeddingProvider
from crystalith.agents.deps import StudioDeps
from crystalith.agents.search_graph import SearchState, run_search_graph
from crystalith.config import Settings
from crystalith.db import Chunk, Notebook, Source, SourceStatus
from crystalith.parsers import Parser, ParserFactory, TranscriptionProvider, UnsupportedDocumentError
from crystalith.vector_storage import VectorStore

from .deps import (
    get_db_session,
    get_embedding_provider,
    get_settings,
    get_transcription_provider,
    get_vector_store,
)


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/sources", tags=["sources"])


class SourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    filename: str
    mime_type: str | None
    parser_type: str
    metadata: dict[str, Any] | None = Field(
        default=None,
        validation_alias="metadata_",
        serialization_alias="metadata",
    )
    status: SourceStatus
    error_message: str | None
    chunk_count: int = 0
    created_at: datetime.datetime
    updated_at: datetime.datetime


class SourceSearchStatus(StrEnum):
    OK = "ok"
    NOT_IMPLEMENTED = "not_implemented"


class SourceSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    engine: str = Field("Web")
    mode: str = Field("Fast Research")

    @field_validator("query")
    @classmethod
    def _strip_query(cls, value: str) -> str:
        trimmed = " ".join(value.strip().split())
        if not trimmed:
            raise ValueError("query must not be empty")
        return trimmed

    @field_validator("engine", "mode")
    @classmethod
    def _strip_label(cls, value: str) -> str:
        return value.strip() or value


class SourceSearchResult(BaseModel):
    title: str
    url: str
    snippet: str | None = None
    source: str | None = None


class SourceSearchResponse(BaseModel):
    status: SourceSearchStatus
    query: str
    engine: str
    mode: str
    results: list[SourceSearchResult]
    message: str | None = None
    created_at: datetime.datetime


class SourceBatchDeleteRequest(BaseModel):
    source_ids: list[int] = Field(..., min_length=1)


class SourceBatchDeleteResponse(BaseModel):
    deleted_ids: list[int]
    deleted_count: int




def _resolve_parser(file: UploadFile, transcriber: TranscriptionProvider) -> Parser:
    try:
        return ParserFactory.from_file(
            filename=file.filename,
            mime_type=file.content_type,
            transcriber=transcriber,
        )
    except UnsupportedDocumentError as exc:
        raise HTTPException(status_code=415, detail="Unsupported file type") from exc


def _page_count_from_chunks(chunks: Iterable[Any]) -> int | None:
    pages: list[int] = []
    for chunk in chunks:
        if not hasattr(chunk, "metadata"):
            continue
        page = chunk.metadata.get("page") if isinstance(chunk.metadata, dict) else None
        if isinstance(page, int):
            pages.append(page)
    return max(pages) if pages else None


def _build_source_metadata(
    chunks: Iterable[Any],
    *,
    parser_type: str,
    parse_time_ms: int,
    page_count: int | None,
) -> dict[str, Any]:
    word_count = 0
    for chunk in chunks:
        text = getattr(chunk, "text", "")
        word_count += len(text.split())
    return {
        "parser_type": parser_type,
        "word_count": word_count,
        "parse_time_ms": parse_time_ms,
        "page_count": page_count,
    }


def _source_to_read(source: Source, *, chunk_count: int) -> SourceRead:
    return SourceRead.model_validate(source).model_copy(
        update={"chunk_count": chunk_count, "metadata": source.metadata_}
    )


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


@router.post("/search", response_model=SourceSearchResponse)
async def search_sources(
    notebook_id: int,
    payload: SourceSearchRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    vector_store: VectorStore = Depends(get_vector_store),
) -> SourceSearchResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    deps = StudioDeps(
        settings=settings,
        session=session,
        vector_store=vector_store,
        embedder=embedder,
    )
    state: SearchState = {
        "query": payload.query,
        "engine": payload.engine,
        "mode": payload.mode,
        "deps": deps,
    }
    result = await run_search_graph(state)
    message = result.get("message", "")
    raw_results = result.get("results", [])
    results = [SourceSearchResult.model_validate(item) for item in raw_results]
    created_at = datetime.datetime.now(datetime.UTC)
    return SourceSearchResponse(
        status=SourceSearchStatus.OK,
        query=payload.query,
        engine=payload.engine,
        mode=payload.mode,
        results=results,
        message=message or "已生成简要搜索结果（TODO: 接入真实搜索）。",
        created_at=created_at,
    )


@router.post("", response_model=SourceRead, status_code=status.HTTP_201_CREATED)
async def upload_source(
    notebook_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    transcriber: TranscriptionProvider = Depends(get_transcription_provider),
    vector_store: VectorStore = Depends(get_vector_store),
) -> SourceRead:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    parser = _resolve_parser(file, transcriber)
    filename = file.filename or "upload.txt"
    mime_type = file.content_type

    source = Source(
        notebook_id=notebook_id,
        filename=filename,
        mime_type=mime_type,
        parser_type=parser.parser_type,
        status=SourceStatus.PROCESSING,
    )
    session.add(source)
    await session.commit()
    await session.refresh(source)

    try:
        raw = await file.read()
        parse_started = perf_counter()
        chunks = parser.parse(raw)
        parse_time_ms = int((perf_counter() - parse_started) * 1000)
        if not chunks:
            raise ValueError("empty document")

        page_count = getattr(parser, "page_count", None)
        if page_count is None:
            page_count = _page_count_from_chunks(chunks)
        source.metadata_ = _build_source_metadata(
            chunks,
            parser_type=parser.parser_type,
            parse_time_ms=parse_time_ms,
            page_count=page_count,
        )

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
                metadata_=chunk.metadata or None,
            )
            session.add(chunk_model)
            chunk_models.append(chunk_model)

        await session.flush()
        chunk_ids = [chunk.id for chunk in chunk_models]

        source.status = SourceStatus.READY
        source.error_message = None
        await session.commit()
        await session.refresh(source)

        await vector_store.add(
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
    vector_store: VectorStore = Depends(get_vector_store),
) -> None:
    source = await session.get(Source, source_id)
    if source is None or source.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Source not found")

    await session.delete(source)
    await session.commit()
    await vector_store.remove_source(source_id)


@router.post("/batch-delete", response_model=SourceBatchDeleteResponse)
async def batch_delete_sources(
    notebook_id: int,
    payload: SourceBatchDeleteRequest,
    session: AsyncSession = Depends(get_db_session),
    vector_store: VectorStore = Depends(get_vector_store),
) -> SourceBatchDeleteResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    source_ids = list(dict.fromkeys(payload.source_ids))
    result = await session.execute(
        select(Source).where(Source.notebook_id == notebook_id, Source.id.in_(source_ids))
    )
    sources = result.scalars().all()
    found_ids = [source.id for source in sources]
    if len(found_ids) != len(source_ids):
        raise HTTPException(status_code=404, detail="Source not found")

    for source in sources:
        await session.delete(source)
    await session.commit()

    for source_id in found_ids:
        await vector_store.remove_source(source_id)

    return SourceBatchDeleteResponse(deleted_ids=found_ids, deleted_count=len(found_ids))
