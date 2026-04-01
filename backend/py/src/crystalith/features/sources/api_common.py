from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Mapping
from typing import Protocol

from cl_logs import get_logger
from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import EmbeddingProvider
from crystalith.shared.cache import CacheProvider
from crystalith.shared.cache.epochs import bump_sources_epoch
from crystalith.shared.db import Chunk, Source, SourceTag, SourceTagMap
from crystalith.shared.json_types import JsonDict, JsonValue
from crystalith.shared.parsers import (
    ParserFactory,
    ParserResolution,
    TranscriptionProvider,
    UnsupportedDocumentError,
)
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.plugins.official_catalog import OFFICIAL_PLUGIN_CATALOG
from crystalith.shared.source_diagnostics import (
    SOURCE_ERROR_EMBEDDING_FAILED,
    SOURCE_ERROR_INGESTION_FAILED,
    SOURCE_ERROR_VECTOR_STORE_FAILED,
    SourceFailure,
    apply_source_failure,
    raise_source_failure,
)
from crystalith.shared.types import SourceStatus
from crystalith.shared.vector_storage import VectorStore, bump_vector_epoch

from .api_schemas import SourceRead

logger = get_logger(__name__)


class _ChunkLike(Protocol):
    @property
    def text(self) -> str:
        ...

    @property
    def metadata(self) -> Mapping[str, JsonValue]:
        ...


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
    try:
        await bump_sources_epoch(cache=cache, notebook_id=notebook_id)
    except Exception as exc:
        logger.warning(
            "sources_cache_epoch_bump_failed",
            notebook_id=notebook_id,
            error=str(exc),
        )
    if vectors_changed:
        try:
            await bump_vector_epoch(cache=cache, notebook_id=notebook_id)
        except Exception as exc:
            logger.warning(
                "vector_cache_epoch_bump_failed",
                notebook_id=notebook_id,
                error=str(exc),
            )


def _resolve_parser(file: UploadFile, transcriber: TranscriptionProvider, plugins: PluginRegistry) -> ParserResolution:
    try:
        return ParserFactory.resolve_from_file(
            filename=file.filename,
            mime_type=file.content_type,
            transcriber=transcriber,
            plugins=plugins,
        )
    except UnsupportedDocumentError as exc:
        required_plugin_id = exc.required_plugin_id
        skipped_detail = plugins.get_load_report().skipped.get(required_plugin_id) if required_plugin_id else None
        catalog_entry = OFFICIAL_PLUGIN_CATALOG.get(required_plugin_id) if required_plugin_id else None
        recovery_hint = (
            skipped_detail.hint
            if skipped_detail is not None and skipped_detail.hint
            else catalog_entry.default_install_hint()
            if catalog_entry is not None
            else f"安装并启用 {required_plugin_id!r} 插件。"
            if required_plugin_id
            else "请检查文件格式与内容，或将文件转换为可解析的文本后重试。"
        )
        details: dict[str, object] = {
            "filename": file.filename,
            "mime_type": file.content_type,
            "recovery_hint": recovery_hint,
        }
        if required_plugin_id:
            details["required_plugin_id"] = required_plugin_id
        if exc.details:
            details["parser_details"] = exc.details
        if skipped_detail is not None:
            details["plugin_diagnostic"] = skipped_detail.to_dict()
        raise HTTPException(
            status_code=415,
            detail={
                "error_code": "PARSER_PLUGIN_REQUIRED" if required_plugin_id else "UNSUPPORTED_FILE_TYPE",
                "message": "不支持的文件类型（缺少或未启用对应解析器插件）" if required_plugin_id else "不支持的文件类型",
                "details": details,
            },
        ) from exc


def _page_count_from_chunks(chunks: Iterable[_ChunkLike]) -> int | None:
    pages: list[int] = []
    for chunk in chunks:
        page = chunk.metadata.get("page")
        if isinstance(page, int):
            pages.append(page)
    return max(pages) if pages else None


def _build_source_metadata(
    chunks: Iterable[_ChunkLike],
    *,
    parser_type: str,
    parser_plugin_id: str | None,
    parse_time_ms: int,
    page_count: int | None,
) -> JsonDict:
    word_count = 0
    for chunk in chunks:
        word_count += len(chunk.text.split())
    payload: JsonDict = {
        "parser_type": parser_type,
        "word_count": word_count,
        "parse_time_ms": parse_time_ms,
        "page_count": page_count,
    }
    if parser_plugin_id:
        payload["parser_plugin_id"] = parser_plugin_id
    return payload


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
                for tag in source.tags
                if tag.name
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
        error_code=source.error_code,
        error_message=source.error_message,
        recovery_hint=source.recovery_hint,
        last_error_at=source.last_error_at,
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
    sources = list(result.scalars().all())
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
    source.error_code = None
    source.error_message = None
    source.recovery_hint = None
    session.add(source)
    await session.commit()
    await session.refresh(source)

    stage: str = "init"
    try:
        stage = "embed"
        embeddings = await embedder.embed_batch([chunk.text for chunk in chunks])
        if len(embeddings) != len(chunks):
            raise ValueError("embedding count mismatch")

        chunk_ids = [chunk.id for chunk in chunks]
        stage = "vector_store"
        await vector_store.remove_source(source.id)
        await vector_store.add(
            notebook_id=notebook_id,
            source_id=source.id,
            chunk_ids=chunk_ids,
            vectors=embeddings,
        )
    except Exception as exc:
        await session.rollback()
        if stage == "embed":
            failure = SourceFailure(
                error_code=SOURCE_ERROR_EMBEDDING_FAILED,
                message="重新嵌入失败：向量嵌入失败",
                recovery_hint="检查 embedding 模型/服务是否可用，或稍后重试。",
                status_code=503,
                details=str(exc)[:512],
            )
        elif stage == "vector_store":
            failure = SourceFailure(
                error_code=SOURCE_ERROR_VECTOR_STORE_FAILED,
                message="重新嵌入失败：写入向量库失败",
                recovery_hint="检查向量库服务配置与连通性，或稍后重试。",
                status_code=503,
                details=str(exc)[:512],
            )
        else:
            failure = SourceFailure(
                error_code=SOURCE_ERROR_INGESTION_FAILED,
                message="重新嵌入失败",
                recovery_hint="可稍后重试；若持续失败，检查日志或依赖服务状态。",
                status_code=500,
                details=str(exc)[:512],
            )
        apply_source_failure(source, failure)
        session.add(source)
        await session.commit()
        await session.refresh(source)
        logger.exception(
            "Source re-embed failed",
            source_id=source.id,
            error=str(exc)[:512],
        )
        raise_source_failure(failure)

    source.status = SourceStatus.READY
    source.error_code = None
    source.error_message = None
    source.recovery_hint = None
    source.last_error_at = None
    session.add(source)
    await session.commit()
    await session.refresh(source)

    return len(chunks)
