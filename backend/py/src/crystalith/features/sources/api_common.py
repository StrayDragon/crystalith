from __future__ import annotations

import hashlib
import json
from typing import Any, Iterable

from cl_logs import get_logger
from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import EmbeddingProvider
from crystalith.shared.cache import CacheProvider
from crystalith.shared.cache.epochs import bump_sources_epoch
from crystalith.shared.db import Chunk, Source, SourceTag, SourceTagMap
from crystalith.shared.parsers import Parser, ParserFactory, TranscriptionProvider, UnsupportedDocumentError
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.types import SourceStatus
from crystalith.shared.vector_storage import VectorStore, bump_vector_epoch

from .api_schemas import SourceRead

logger = get_logger(__name__)


def _sources_list_cache_key(
    *,
    notebook_id: int,
    epoch: int,
    tag: str | None,
    sort_by: str,
    sort_order: str,
) -> str:
    payload = {"tag": tag, "sort_by": sort_by, "sort_order": sort_order}
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:16]
    return f"notebook:{notebook_id}:sources:v{int(epoch)}:list:{digest}"


async def _invalidate_notebook_source_caches(
    cache: CacheProvider, *, notebook_id: int, vectors_changed: bool = False
) -> None:
    await bump_sources_epoch(cache=cache, notebook_id=notebook_id)
    if vectors_changed:
        await bump_vector_epoch(cache=cache, notebook_id=notebook_id)


def _resolve_parser(file: UploadFile, transcriber: TranscriptionProvider, plugins: PluginRegistry) -> Parser:
    try:
        try:
            return ParserFactory.from_file(
                filename=file.filename,
                mime_type=file.content_type,
                transcriber=transcriber,
                plugins=plugins,
            )
        except TypeError as exc:
            if "plugins" not in str(exc):
                raise
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


def _source_to_read(
    source: Source,
    *,
    chunk_count: int,
    tags: list[str] | None = None,
) -> SourceRead:
    if tags is None:
        tags = sorted(
            {
                tag.name
                for tag in getattr(source, "tags", [])
                if isinstance(getattr(tag, "name", None), str) and tag.name
            }
        )

    return SourceRead(
        id=source.id,
        notebook_id=source.notebook_id,
        filename=source.filename,
        mime_type=source.mime_type,
        parser_type=source.parser_type,
        metadata=source.metadata_,
        status=source.status,
        error_message=source.error_message,
        chunk_count=chunk_count,
        tags=tags,
        created_at=source.created_at,
        updated_at=source.updated_at,
    )


async def _load_tag_names_for_sources(
    session: AsyncSession,
    *,
    source_ids: list[int],
) -> dict[int, list[str]]:
    if not source_ids:
        return {}

    result = await session.execute(
        select(SourceTagMap.source_id, SourceTag.name)
        .join(SourceTag, SourceTag.id == SourceTagMap.tag_id)
        .where(SourceTagMap.source_id.in_(source_ids))
    )
    tag_map: dict[int, list[str]] = {}
    for source_id, tag_name in result.all():
        if not isinstance(tag_name, str) or not tag_name:
            continue
        tag_map.setdefault(source_id, []).append(tag_name)

    for source_id in tag_map:
        tag_map[source_id] = sorted(set(tag_map[source_id]))

    return tag_map


async def _fetch_sources_or_404(
    session: AsyncSession,
    *,
    notebook_id: int,
    source_ids: list[int],
) -> list[Source]:
    unique_ids = list(dict.fromkeys(source_ids))
    result = await session.execute(
        select(Source).where(Source.notebook_id == notebook_id, Source.id.in_(unique_ids))
    )
    sources = result.scalars().all()
    found_ids = {source.id for source in sources}
    missing_ids = [source_id for source_id in unique_ids if source_id not in found_ids]
    if missing_ids:
        raise HTTPException(status_code=404, detail="Source not found")
    return sources


async def _reembed_existing_source(
    *,
    notebook_id: int,
    source: Source,
    session: AsyncSession,
    embedder: EmbeddingProvider,
    vector_store: VectorStore,
    require_failed: bool,
) -> int:
    if require_failed and source.status != SourceStatus.FAILED:
        raise HTTPException(status_code=400, detail="Source is not failed")
    if source.status == SourceStatus.PROCESSING:
        raise HTTPException(status_code=400, detail="Source is processing")

    result = await session.execute(
        select(Chunk)
        .where(Chunk.source_id == source.id)
        .order_by(Chunk.chunk_index.asc())
    )
    chunks = result.scalars().all()
    if not chunks:
        raise HTTPException(status_code=400, detail="Source has no chunks to re-embed")

    source.status = SourceStatus.PROCESSING
    source.error_message = None
    session.add(source)
    await session.commit()
    await session.refresh(source)

    try:
        embeddings = await embedder.embed_batch([chunk.text for chunk in chunks])
        if len(embeddings) != len(chunks):
            raise ValueError("embedding count mismatch")

        chunk_ids = [chunk.id for chunk in chunks]
        await vector_store.remove_source(source.id)
        await vector_store.add(
            notebook_id=notebook_id,
            source_id=source.id,
            chunk_ids=chunk_ids,
            vectors=embeddings,
        )
    except Exception as exc:
        await session.rollback()
        source.status = SourceStatus.FAILED
        error_detail = str(exc)[:512]
        source.error_message = error_detail
        session.add(source)
        await session.commit()
        await session.refresh(source)
        logger.exception(
            "Source re-embed failed",
            source_id=source.id,
            error=error_detail,
        )
        raise HTTPException(status_code=500, detail=f"Re-embed failed: {error_detail}") from exc

    source.status = SourceStatus.READY
    source.error_message = None
    session.add(source)
    await session.commit()
    await session.refresh(source)

    return len(chunks)
