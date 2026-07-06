from __future__ import annotations

import contextlib
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from lush_logx import get_logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import EmbeddingProvider
from crystalith.shared.cache import CacheProvider
from crystalith.shared.cache.epochs import get_sources_epoch
from crystalith.shared.db import Chunk, Notebook, Source, SourceTag, SourceTagMap
from crystalith.shared.deps import (
    get_cache_provider,
    get_db_session,
    get_embedding_provider,
    get_vector_store,
)
from crystalith.shared.vector_storage import VectorStore

from .api_common import (
    _invalidate_notebook_source_caches,
    _load_tag_names_for_sources,
    _reembed_existing_source,
    _source_to_read,
    _sources_list_cache_key,
)
from .api_schemas import (
    ChunkRead,
    SourceBatchDeleteRequest,
    SourceBatchDeleteResponse,
    SourceBatchItemResult,
    SourceBatchReembedRequest,
    SourceBatchReembedResponse,
    SourceRead,
)

logger = get_logger(__name__)

router = APIRouter()


@router.get("", response_model=list[SourceRead])
async def list_sources(
    notebook_id: int,
    tag: str | None = None,
    sort_by: Literal["date", "name", "size", "type"] = "date",
    sort_order: Literal["asc", "desc"] = "desc",
    session: AsyncSession = Depends(get_db_session),
    cache: CacheProvider = Depends(get_cache_provider),
) -> list[SourceRead]:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    normalized_tag = " ".join((tag or "").strip().split())
    if not normalized_tag:
        normalized_tag = None

    epoch = await get_sources_epoch(cache=cache, notebook_id=notebook_id)
    cache_key = _sources_list_cache_key(
        notebook_id=notebook_id,
        epoch=epoch,
        tag=normalized_tag,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    cached = await cache.get(cache_key)
    if isinstance(cached, list):
        logger.info("cache_hit", key=cache_key)
        try:
            return [SourceRead.model_validate(item) for item in cached]
        except Exception:
            with contextlib.suppress(Exception):
                await cache.delete(cache_key)
    logger.info("cache_miss", key=cache_key)

    chunk_count = func.count(Chunk.id)
    statement = (
        select(Source, chunk_count)
        .outerjoin(Chunk, Chunk.source_id == Source.id)
        .where(Source.notebook_id == notebook_id)
    )

    if normalized_tag is not None:
        statement = (
            statement
            .join(SourceTagMap, SourceTagMap.source_id == Source.id)
            .join(SourceTag, SourceTag.id == SourceTagMap.tag_id)
            .where(SourceTag.name == normalized_tag)
        )

    statement = statement.group_by(Source.id)

    if sort_by == "name":
        sort_column = func.lower(Source.filename)
    elif sort_by == "size":
        sort_column = chunk_count
    elif sort_by == "type":
        sort_column = func.lower(func.coalesce(Source.mime_type, ""))
    else:
        sort_column = Source.created_at

    if sort_order == "asc":
        statement = statement.order_by(sort_column.asc(), Source.id.asc())
    else:
        statement = statement.order_by(sort_column.desc(), Source.id.desc())

    result = await session.execute(statement)
    rows = result.all()

    source_ids = [source.id for source, _ in rows]
    tags_by_source = await _load_tag_names_for_sources(session, source_ids=source_ids)

    payload = [
        _source_to_read(source, chunk_count=count or 0, tags=tags_by_source.get(source.id, []))
        for source, count in rows
    ]

    await cache.set(cache_key, [item.model_dump(mode="json") for item in payload])
    return payload


@router.post("/batch/re-embed", response_model=SourceBatchReembedResponse)
async def batch_reembed_sources(
    notebook_id: int,
    payload: SourceBatchReembedRequest,
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    vector_store: VectorStore = Depends(get_vector_store),
    cache: CacheProvider = Depends(get_cache_provider),
) -> SourceBatchReembedResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    source_ids = list(dict.fromkeys(payload.source_ids))
    result = await session.execute(
        select(Source).where(Source.notebook_id == notebook_id, Source.id.in_(source_ids))
    )
    sources = list(result.scalars().all())
    source_map = {source.id: source for source in sources}

    reembedded_ids: list[int] = []
    failed_ids: list[int] = []
    results: list[SourceBatchItemResult] = []

    for source_id in source_ids:
        source = source_map.get(source_id)
        if source is None:
            failed_ids.append(source_id)
            results.append(
                SourceBatchItemResult(
                    source_id=source_id,
                    ok=False,
                    error_code="SOURCE_NOT_FOUND",
                    message="Source not found",
                )
            )
            continue

        try:
            await _reembed_existing_source(
                notebook_id=notebook_id,
                source=source,
                session=session,
                embedder=embedder,
                vector_store=vector_store,
                require_failed=False,
            )
            reembedded_ids.append(source_id)
            results.append(SourceBatchItemResult(source_id=source_id, ok=True))
        except HTTPException as exc:
            failed_ids.append(source_id)
            detail = exc.detail
            error_code: str | None = None
            message: str | None = None
            if isinstance(detail, dict):
                code = detail.get("error_code")
                msg = detail.get("message")
                if isinstance(code, str):
                    error_code = code
                if isinstance(msg, str):
                    message = msg
            results.append(
                SourceBatchItemResult(
                    source_id=source_id,
                    ok=False,
                    error_code=error_code or "SOURCE_REEMBED_FAILED",
                    message=message or "Re-embed failed",
                )
            )
        except Exception:
            failed_ids.append(source_id)
            results.append(
                SourceBatchItemResult(
                    source_id=source_id,
                    ok=False,
                    error_code="SOURCE_REEMBED_FAILED",
                    message="Re-embed failed",
                )
            )

    if reembedded_ids:
        await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id, vectors_changed=True)

    return SourceBatchReembedResponse(
        results=results,
        reembedded_ids=reembedded_ids,
        failed_ids=failed_ids,
        reembedded_count=len(reembedded_ids),
        failed_count=len(failed_ids),
    )


@router.post("/{source_id}/re-embed", response_model=SourceRead)
async def reembed_source(
    notebook_id: int,
    source_id: int,
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    vector_store: VectorStore = Depends(get_vector_store),
    cache: CacheProvider = Depends(get_cache_provider),
) -> SourceRead:
    """Retry embedding for a failed source using existing chunks."""
    source = await session.get(Source, source_id)
    if source is None or source.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Source not found")

    chunk_count = await _reembed_existing_source(
        notebook_id=notebook_id,
        source=source,
        session=session,
        embedder=embedder,
        vector_store=vector_store,
        require_failed=True,
    )
    tags_by_source = await _load_tag_names_for_sources(session, source_ids=[source.id])
    await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id, vectors_changed=True)
    return _source_to_read(source, chunk_count=chunk_count, tags=tags_by_source.get(source.id, []))


@router.delete("/batch", response_model=SourceBatchDeleteResponse)
async def batch_delete_sources(
    notebook_id: int,
    payload: SourceBatchDeleteRequest,
    session: AsyncSession = Depends(get_db_session),
    vector_store: VectorStore = Depends(get_vector_store),
    cache: CacheProvider = Depends(get_cache_provider),
) -> SourceBatchDeleteResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    source_ids = list(dict.fromkeys(payload.source_ids))
    result = await session.execute(
        select(Source).where(Source.notebook_id == notebook_id, Source.id.in_(source_ids))
    )
    sources = list(result.scalars().all())
    source_map = {source.id: source for source in sources}

    results: list[SourceBatchItemResult] = []
    deleted_ids: list[int] = []

    for source_id in source_ids:
        source = source_map.get(source_id)
        if source is None:
            results.append(
                SourceBatchItemResult(
                    source_id=source_id,
                    ok=False,
                    error_code="SOURCE_NOT_FOUND",
                    message="Source not found",
                )
            )
            continue
        await session.delete(source)
        deleted_ids.append(source_id)
        results.append(SourceBatchItemResult(source_id=source_id, ok=True))

    if deleted_ids:
        await session.commit()
        for source_id in deleted_ids:
            try:
                await vector_store.remove_source(source_id)
            except Exception:
                logger.exception("failed to purge source vectors after deletion", source_id=source_id)

        await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id, vectors_changed=True)

    return SourceBatchDeleteResponse(
        results=results,
        deleted_ids=deleted_ids,
        deleted_count=len(deleted_ids),
    )

@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(
    notebook_id: int,
    source_id: int,
    session: AsyncSession = Depends(get_db_session),
    vector_store: VectorStore = Depends(get_vector_store),
    cache: CacheProvider = Depends(get_cache_provider),
) -> None:
    source = await session.get(Source, source_id)
    if source is None or source.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Source not found")

    await session.delete(source)
    await session.commit()
    await vector_store.remove_source(source_id)
    await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id, vectors_changed=True)


@router.get("/{source_id}/chunks", response_model=list[ChunkRead])
async def list_source_chunks(
    notebook_id: int,
    source_id: int,
    session: AsyncSession = Depends(get_db_session),
    cache: CacheProvider = Depends(get_cache_provider),
) -> list[ChunkRead]:
    """获取来源的所有文本片段（chunks）。

    返回指定来源的所有文本片段，按 chunk_index 升序排列。
    每个片段包含：
    - id: 片段唯一标识
    - chunk_index: 片段索引（从0开始）
    - text: 片段文本内容
    - start_offset: 在原文中的起始位置
    - end_offset: 在原文中的结束位置
    - metadata: 片段元数据（如页码等）
    """
    source = await session.get(Source, source_id)
    if source is None or source.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Source not found")

    epoch = await get_sources_epoch(cache=cache, notebook_id=notebook_id)
    cache_key = f"notebook:{notebook_id}:sources:v{int(epoch)}:{source_id}:chunks"
    cached = await cache.get(cache_key)
    if isinstance(cached, list):
        logger.info("cache_hit", key=cache_key)
        try:
            return [ChunkRead.model_validate(item) for item in cached]
        except Exception:
            with contextlib.suppress(Exception):
                await cache.delete(cache_key)
    logger.info("cache_miss", key=cache_key)

    result = await session.execute(
        select(Chunk)
        .where(Chunk.source_id == source_id)
        .order_by(Chunk.chunk_index.asc())
    )
    chunks = result.scalars().all()

    payload = [
        ChunkRead(
            id=chunk.id,
            chunk_index=chunk.chunk_index,
            text=chunk.text,
            start_offset=chunk.start_offset,
            end_offset=chunk.end_offset,
            metadata=chunk.metadata_,
        )
        for chunk in chunks
    ]

    await cache.set(cache_key, [item.model_dump(mode="json") for item in payload])
    return payload
