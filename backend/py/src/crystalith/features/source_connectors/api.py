from __future__ import annotations

import asyncio
import datetime
import hashlib
import uuid
from time import perf_counter
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, status
from jsonschema import Draft7Validator
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.features.source_connectors.schemas import (
    ConnectorBindingRead,
    CreateConnectorBindingRequest,
    Diagnostic,
    ImportResultItem,
    ImportScope,
    ImportScopeApplyResponse,
    SourceConnectorCapabilities,
    SourceConnectorDescriptor,
    SourceConnectorsListResponse,
    Snapshot,
    SnapshotEntry,
    SyncCandidate,
    SyncCandidates,
    SyncCheckResult,
)
from crystalith.shared.config import Settings
from crystalith.shared.ai.interfaces import EmbeddingProvider
from crystalith.shared.cache import CacheProvider
from crystalith.shared.db import Chunk, Notebook, Source, SourceConnectorBinding
from crystalith.shared.deps import (
    get_cache_provider,
    get_db_session,
    get_embedding_provider,
    get_plugin_registry,
    get_settings,
    get_transcription_provider,
    get_vector_store,
)
from crystalith.shared.json_types import JsonDict, JsonValue
from crystalith.shared.parsers import ParserFactory, TranscriptionProvider, UnsupportedDocumentError
from crystalith.shared.parsers.interfaces import ParserWithDocumentMetadata
from crystalith.shared.plugins import PluginRegistry, SourceConnectorPlugin
from crystalith.shared.plugins.official_catalog import OFFICIAL_PLUGIN_CATALOG
from crystalith.shared.source_connectors.paths import (
    normalize_directory_path,
    normalize_file_path,
    normalize_relative_path,
    path_in_scope,
)
from crystalith.shared.source_diagnostics import (
    SOURCE_ERROR_EMBEDDING_FAILED,
    SOURCE_ERROR_INGESTION_FAILED,
    SOURCE_ERROR_PARSER_FAILED,
    SOURCE_ERROR_VECTOR_STORE_FAILED,
    SourceFailure,
    apply_source_failure,
)
from crystalith.shared.types import SourceStatus
from crystalith.shared.vector_storage import VectorStore

from crystalith.features.sources.api_common import (
    _build_source_metadata,
    _invalidate_notebook_source_caches,
    _page_count_from_chunks,
)


router = APIRouter(prefix="/v1/notebooks/{notebook_id}", tags=["source-connectors"])


def _make_jsonschema_validator(schema: JsonDict) -> Draft7Validator:
    try:
        Draft7Validator.check_schema(schema)
    except Exception as exc:  # noqa: BLE001 - plugin boundary
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "CONNECTOR_SCHEMA_INVALID",
                "message": "连接器配置 schema 非法",
                "details": {"error": type(exc).__name__, "message": str(exc)[:512]},
            },
        ) from exc
    return Draft7Validator(schema)


def _validate_with_jsonschema(schema: JsonDict, data: JsonDict) -> list[str]:
    validator = _make_jsonschema_validator(schema)
    errors: list[str] = []
    for error in validator.iter_errors(data):
        path = " -> ".join(str(p) for p in error.absolute_path) if error.absolute_path else "root"
        errors.append(f"[{path}] {error.message}")
    return errors


def _parse_diagnostic(raw: object) -> Diagnostic | None:
    if not isinstance(raw, dict):
        return None
    error_code = str(raw.get("error_code") or raw.get("code") or "DIAGNOSTIC")
    message = str(raw.get("message") or "")
    hint = raw.get("hint")
    details = raw.get("details")
    return Diagnostic(
        error_code=error_code,
        message=message,
        hint=str(hint) if hint is not None else None,
        details=cast(JsonValue | None, details),
    )


async def _get_connector_diagnostics(
    plugin: SourceConnectorPlugin,
    *,
    settings: Settings,
) -> list[Diagnostic] | None:
    try:
        raw = await plugin.get_diagnostics(settings, connection_config=None)
    except Exception as exc:  # noqa: BLE001 - plugin boundary
        return [
            Diagnostic(
                error_code="CONNECTOR_DIAGNOSTICS_FAILED",
                message="连接器诊断失败",
                hint="检查连接器插件依赖与配置，或查看后端日志。",
                details=str(exc)[:512],
            )
        ]

    if not raw:
        return None

    parsed: list[Diagnostic] = []
    for item in raw:
        diag = _parse_diagnostic(item)
        if diag is not None:
            parsed.append(diag)
    return parsed or None


@router.get("/source-connectors", response_model=SourceConnectorsListResponse)
async def list_source_connectors(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> SourceConnectorsListResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    connectors: list[SourceConnectorDescriptor] = []
    for connector_id in plugins.list_source_connectors():
        plugin = plugins.source_connectors[connector_id]
        connectors.append(
            SourceConnectorDescriptor(
                connector_id=connector_id,
                display_name=plugin.display_name,
                description=plugin.description,
                connection_config_schema=plugin.connection_config_schema,
                diagnostics=await _get_connector_diagnostics(plugin, settings=settings),
                capabilities=SourceConnectorCapabilities(
                    supports_snapshot=plugin.supports_snapshot,
                    supports_sync_check=plugin.supports_sync_check,
                ),
            )
        )

    return SourceConnectorsListResponse(connectors=connectors)


@router.post(
    "/source-connectors/{connector_id}/bindings",
    response_model=ConnectorBindingRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_connector_binding(
    notebook_id: int,
    connector_id: str,
    payload: CreateConnectorBindingRequest,
    session: AsyncSession = Depends(get_db_session),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> ConnectorBindingRead:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    normalized_connector_id = connector_id.strip()
    if not normalized_connector_id:
        raise HTTPException(status_code=400, detail="connector_id must not be empty")

    plugin: SourceConnectorPlugin | None = plugins.source_connectors.get(normalized_connector_id)
    if plugin is None:
        raise HTTPException(status_code=404, detail="Source connector not found")

    schema = plugin.connection_config_schema
    data = cast(JsonDict, payload.connection_config or {})
    errors = _validate_with_jsonschema(schema, data)
    if errors:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "CONNECTOR_CONFIG_INVALID",
                "message": "连接参数校验失败",
                "details": {"errors": errors},
            },
        )

    binding = SourceConnectorBinding(
        notebook_id=notebook_id,
        connector_id=normalized_connector_id,
        connection_config=data,
        import_scope=None,
        last_confirmed_snapshot=None,
        last_sync_check_result=None,
    )
    session.add(binding)
    await session.commit()
    await session.refresh(binding)
    return ConnectorBindingRead.model_validate(binding, from_attributes=True)


async def _get_binding_or_404(
    session: AsyncSession,
    *,
    notebook_id: int,
    binding_id: int,
) -> SourceConnectorBinding:
    binding = await session.get(SourceConnectorBinding, binding_id)
    if binding is None or binding.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Connector binding not found")
    return binding


def _get_connector_plugin_or_409(
    connector_id: str,
    *,
    plugins: PluginRegistry,
) -> SourceConnectorPlugin:
    plugin = plugins.source_connectors.get(connector_id)
    if plugin is not None:
        return plugin

    skipped_detail = plugins.get_load_report().skipped.get(connector_id)
    hint = skipped_detail.hint if skipped_detail is not None and skipped_detail.hint else None
    details: dict[str, JsonValue] = {"connector_id": connector_id}
    if skipped_detail is not None:
        details["plugin_diagnostic"] = cast(JsonValue, skipped_detail.to_dict())
        if hint is None:
            hint = skipped_detail.hint
    if hint is None:
        hint = f"安装并启用 {connector_id!r} 连接器插件。"
    raise HTTPException(
        status_code=409,
        detail={
            "error_code": "CONNECTOR_UNAVAILABLE",
            "message": "连接器插件不可用",
            "hint": hint,
            "details": details,
        },
    )


def _normalize_snapshot_entry(raw: object) -> SnapshotEntry:
    if not isinstance(raw, dict):
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "CONNECTOR_SNAPSHOT_ENTRY_INVALID",
                "message": "连接器返回的快照条目非法",
                "details": {"entry_type": type(raw).__name__},
            },
        )
    relative_path_raw = raw.get("relative_path")
    if not isinstance(relative_path_raw, str):
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "CONNECTOR_SNAPSHOT_ENTRY_INVALID",
                "message": "连接器返回的快照条目缺少 relative_path",
                "details": {"relative_path_type": type(relative_path_raw).__name__},
            },
        )

    try:
        relative_path = normalize_relative_path(relative_path_raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "CONNECTOR_SNAPSHOT_ENTRY_INVALID_PATH",
                "message": "连接器返回了非法路径",
                "hint": "连接器必须返回 vault 根目录相对路径，不允许绝对路径、.. 或 ./ 前缀。",
                "details": {"relative_path": relative_path_raw, "error": str(exc)},
            },
        ) from exc

    payload = dict(raw)
    payload["relative_path"] = relative_path
    modified_at = payload.get("modified_at")
    if modified_at is not None and not isinstance(modified_at, str):
        payload["modified_at"] = str(modified_at)

    try:
        return SnapshotEntry.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "CONNECTOR_SNAPSHOT_ENTRY_INVALID",
                "message": "连接器返回的快照条目字段不符合约束",
                "details": {"relative_path": relative_path, "error": str(exc)[:512]},
            },
        ) from exc


async def _build_snapshot(
    plugin: SourceConnectorPlugin,
    *,
    settings: Settings,
    connection_config: JsonDict,
) -> Snapshot:
    try:
        raw_entries = await plugin.list_snapshot_entries(settings, connection_config=connection_config)
    except Exception as exc:  # noqa: BLE001 - plugin boundary
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "CONNECTOR_SNAPSHOT_FAILED",
                "message": "连接器快照枚举失败",
                "hint": "检查连接参数与插件运行环境，或查看后端日志。",
                "details": {"error": type(exc).__name__, "message": str(exc)[:512]},
            },
        ) from exc

    if not isinstance(raw_entries, list):
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "CONNECTOR_SNAPSHOT_INVALID",
                "message": "连接器快照返回值非法（必须为列表）",
                "details": {"value_type": type(raw_entries).__name__},
            },
        )

    entries: list[SnapshotEntry] = []
    seen: set[str] = set()
    for item in raw_entries:
        entry = _normalize_snapshot_entry(item)
        if entry.relative_path in seen:
            raise HTTPException(
                status_code=500,
                detail={
                    "error_code": "CONNECTOR_SNAPSHOT_DUPLICATE_PATH",
                    "message": "连接器快照包含重复路径",
                    "details": {"relative_path": entry.relative_path},
                },
            )
        seen.add(entry.relative_path)
        entries.append(entry)

    entries.sort(key=lambda e: e.relative_path)
    return Snapshot(
        generated_at=datetime.datetime.now(datetime.UTC),
        entries=entries,
    )


def _normalize_import_scope(scope: ImportScope) -> tuple[list[str], list[str]]:
    raw_directories = scope.include_directories or []
    raw_files = scope.include_files or []
    if not raw_directories and not raw_files:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "IMPORT_SCOPE_EMPTY",
                "message": "导入范围不能为空",
                "hint": "至少选择一个目录或文件。",
            },
        )

    directories: list[str] = []
    for value in raw_directories:
        text = str(value or "").strip()
        if not text:
            continue
        try:
            directories.append(normalize_directory_path(text))
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": "IMPORT_SCOPE_INVALID_PATH",
                    "message": "导入范围目录路径非法",
                    "details": {"path": text, "error": str(exc)},
                },
            ) from exc

    files: list[str] = []
    for value in raw_files:
        text = str(value or "").strip()
        if not text:
            continue
        try:
            files.append(normalize_file_path(text))
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": "IMPORT_SCOPE_INVALID_PATH",
                    "message": "导入范围文件路径非法",
                    "details": {"path": text, "error": str(exc)},
                },
            ) from exc

    directories = list(dict.fromkeys(directories))
    files = list(dict.fromkeys(files))
    if not directories and not files:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "IMPORT_SCOPE_EMPTY",
                "message": "导入范围不能为空",
                "hint": "至少选择一个目录或文件。",
            },
        )

    return directories, files


def _build_sync_candidates(
    *,
    base_snapshot: Snapshot | None,
    current_snapshot: Snapshot,
) -> SyncCandidates:
    base_entries = base_snapshot.entries if base_snapshot is not None else []
    base_map = {entry.relative_path: entry for entry in base_entries}
    current_map = {entry.relative_path: entry for entry in current_snapshot.entries}

    added: list[SyncCandidate] = []
    updated: list[SyncCandidate] = []
    missing: list[SyncCandidate] = []

    for path, current in current_map.items():
        base = base_map.get(path)
        if base is None:
            added.append(SyncCandidate(relative_path=path, current=current, base=None, reason=None))
            continue
        if base.size_bytes != current.size_bytes or base.modified_at != current.modified_at:
            reasons: list[str] = []
            if base.size_bytes != current.size_bytes:
                reasons.append("size_bytes 变化")
            if base.modified_at != current.modified_at:
                reasons.append("modified_at 变化")
            updated.append(
                SyncCandidate(
                    relative_path=path,
                    current=current,
                    base=base,
                    reason="; ".join(reasons) if reasons else None,
                )
            )

    for path, base in base_map.items():
        if path not in current_map:
            missing.append(SyncCandidate(relative_path=path, current=None, base=base, reason=None))

    added.sort(key=lambda item: item.relative_path)
    updated.sort(key=lambda item: item.relative_path)
    missing.sort(key=lambda item: item.relative_path)
    return SyncCandidates(added=added, updated=updated, missing=missing)


def _resolve_parser_for_file(
    *,
    filename: str,
    mime_type: str | None,
    transcriber: TranscriptionProvider,
    plugins: PluginRegistry,
) -> tuple[object | None, str | None, Diagnostic | None]:
    try:
        try:
            resolution = ParserFactory.resolve_from_file(
                filename=filename,
                mime_type=mime_type,
                transcriber=transcriber,
                plugins=plugins,
            )
        except TypeError as exc:
            if "plugins" not in str(exc):
                raise
            resolution = ParserFactory.resolve_from_file(
                filename=filename,
                mime_type=mime_type,
                transcriber=transcriber,
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
        details: dict[str, JsonValue] = {
            "filename": filename,
            "mime_type": (mime_type or "").split(";")[0].strip().lower() or None,
            "recovery_hint": recovery_hint,
        }
        if required_plugin_id:
            details["required_plugin_id"] = required_plugin_id
        if exc.details:
            details["parser_details"] = cast(JsonValue, exc.details)
        if skipped_detail is not None:
            details["plugin_diagnostic"] = cast(JsonValue, skipped_detail.to_dict())
        return (
            None,
            None,
            Diagnostic(
                error_code="PARSER_PLUGIN_REQUIRED" if required_plugin_id else "UNSUPPORTED_FILE_TYPE",
                message="不支持的文件类型（缺少或未启用对应解析器插件）" if required_plugin_id else "不支持的文件类型",
                hint=recovery_hint,
                details=details,
            ),
        )

    return resolution.parser, resolution.parser_plugin_id, None


async def _ingest_source_bytes(
    *,
    notebook_id: int,
    filename: str,
    mime_type: str | None,
    raw: bytes,
    session: AsyncSession,
    settings: Settings,
    embedder: EmbeddingProvider,
    transcriber: TranscriptionProvider,
    vector_store: VectorStore,
    plugins: PluginRegistry,
    connector_metadata: JsonDict,
    dedup_key: str,
) -> tuple[Source | None, Diagnostic | None]:
    source = Source(
        notebook_id=notebook_id,
        filename=filename,
        mime_type=mime_type,
        parser_type="text",
        dedup_key=dedup_key,
        status=SourceStatus.PROCESSING,
    )
    session.add(source)
    await session.commit()
    await session.refresh(source)

    parser, parser_plugin_id, skip_diag = _resolve_parser_for_file(
        filename=filename,
        mime_type=mime_type,
        transcriber=transcriber,
        plugins=plugins,
    )
    if skip_diag is not None:
        await session.delete(source)
        await session.commit()
        return None, skip_diag
    if parser is None:  # pragma: no cover - defensive
        await session.delete(source)
        await session.commit()
        return None, Diagnostic(error_code="UNSUPPORTED_FILE_TYPE", message="不支持的文件类型")

    source.parser_type = parser.parser_type

    stage = "parse"
    try:
        parse_started = perf_counter()
        loop = asyncio.get_running_loop()
        chunks = await loop.run_in_executor(None, parser.parse, raw)
        parse_time_ms = int((perf_counter() - parse_started) * 1000)
        if not chunks:
            await session.delete(source)
            await session.commit()
            return (
                None,
                Diagnostic(
                    error_code="EMPTY_DOCUMENT",
                    message="空文档，已跳过",
                    hint="请检查文件内容是否为空。",
                    details={"filename": filename},
                ),
            )

        page_count = parser.page_count
        if page_count is None:
            page_count = _page_count_from_chunks(chunks)
        source_metadata = _build_source_metadata(
            chunks,
            parser_type=parser.parser_type,
            parser_plugin_id=parser_plugin_id,
            parse_time_ms=parse_time_ms,
            page_count=page_count,
        )
        if isinstance(parser, ParserWithDocumentMetadata) and parser.document_metadata:
            source_metadata = {**source_metadata, **parser.document_metadata}
        source_metadata["source_connector"] = connector_metadata
        source.metadata_ = source_metadata

        stage = "embed"
        embeddings = await embedder.embed_batch([chunk.text for chunk in chunks])
        if len(embeddings) != len(chunks):
            raise ValueError("embedding count mismatch")

        stage = "chunks"
        chunk_models: list[Chunk] = []
        for index, chunk in enumerate(chunks):
            chunk_model = Chunk(
                source_id=source.id,
                chunk_index=index,
                text=chunk.text,
                start_offset=chunk.start_offset,
                end_offset=chunk.end_offset,
                metadata_=cast(JsonDict, chunk.metadata) or None,
            )
            session.add(chunk_model)
            chunk_models.append(chunk_model)

        await session.flush()
        chunk_ids = [chunk.id for chunk in chunk_models]

        stage = "commit_ready"
        source.status = SourceStatus.READY
        source.error_code = None
        source.error_message = None
        source.recovery_hint = None
        source.last_error_at = None
        await session.commit()
        await session.refresh(source)

        stage = "vector_store"
        await vector_store.add(
            notebook_id=notebook_id,
            source_id=source.id,
            chunk_ids=chunk_ids,
            vectors=embeddings,
        )

        return source, None
    except Exception as exc:  # noqa: BLE001
        await session.rollback()
        if stage == "parse":
            failure = SourceFailure(
                error_code=SOURCE_ERROR_PARSER_FAILED,
                message="解析失败",
                recovery_hint="请检查文件格式与内容，或尝试将文件转换为可解析的文本后重试。",
                status_code=500,
                details=str(exc)[:512],
            )
        elif stage == "embed":
            failure = SourceFailure(
                error_code=SOURCE_ERROR_EMBEDDING_FAILED,
                message="向量嵌入失败",
                recovery_hint="检查 embedding 模型/服务是否可用，或稍后重试。",
                status_code=503,
                details=str(exc)[:512],
            )
        elif stage == "vector_store":
            failure = SourceFailure(
                error_code=SOURCE_ERROR_VECTOR_STORE_FAILED,
                message="写入向量库失败",
                recovery_hint="检查向量库服务配置与连通性，或稍后重试。",
                status_code=503,
                details=str(exc)[:512],
            )
        else:
            failure = SourceFailure(
                error_code=SOURCE_ERROR_INGESTION_FAILED,
                message="导入失败",
                recovery_hint="可稍后重试；若持续失败，检查日志或依赖服务状态。",
                status_code=500,
                details=str(exc)[:512],
            )
        apply_source_failure(source, failure)
        session.add(source)
        await session.commit()
        await session.refresh(source)
        return (
            source,
            Diagnostic(
                error_code=failure.error_code,
                message=failure.message,
                hint=failure.recovery_hint,
                details=cast(JsonValue | None, failure.details),
            ),
        )


@router.post(
    "/source-connector-bindings/{binding_id}/snapshot",
    response_model=Snapshot,
)
async def snapshot_binding(
    notebook_id: int,
    binding_id: int,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> Snapshot:
    binding = await _get_binding_or_404(session, notebook_id=notebook_id, binding_id=binding_id)
    plugin = _get_connector_plugin_or_409(binding.connector_id, plugins=plugins)
    if not plugin.supports_snapshot:
        raise HTTPException(status_code=400, detail="Connector does not support snapshot")
    return await _build_snapshot(plugin, settings=settings, connection_config=binding.connection_config)


@router.post(
    "/source-connector-bindings/{binding_id}/sync-check",
    response_model=SyncCheckResult,
)
async def sync_check_binding(
    notebook_id: int,
    binding_id: int,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> SyncCheckResult:
    binding = await _get_binding_or_404(session, notebook_id=notebook_id, binding_id=binding_id)
    plugin = _get_connector_plugin_or_409(binding.connector_id, plugins=plugins)
    if not plugin.supports_sync_check:
        raise HTTPException(status_code=400, detail="Connector does not support sync_check")

    base_snapshot: Snapshot | None = None
    if binding.last_confirmed_snapshot is not None:
        base_snapshot = Snapshot.model_validate(binding.last_confirmed_snapshot)

    current_snapshot = await _build_snapshot(plugin, settings=settings, connection_config=binding.connection_config)
    candidates = _build_sync_candidates(base_snapshot=base_snapshot, current_snapshot=current_snapshot)
    result = SyncCheckResult(
        id=str(uuid.uuid4()),
        checked_at=datetime.datetime.now(datetime.UTC),
        base_snapshot=base_snapshot,
        current_snapshot=current_snapshot,
        candidates=candidates,
    )

    binding.last_sync_check_result = cast(JsonDict, result.model_dump(mode="json", exclude_none=True))
    session.add(binding)
    await session.commit()

    return result


@router.post(
    "/source-connector-bindings/{binding_id}/import-scope",
    response_model=ImportScopeApplyResponse,
)
async def apply_import_scope(
    notebook_id: int,
    binding_id: int,
    payload: ImportScope,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    transcriber: TranscriptionProvider = Depends(get_transcription_provider),
    vector_store: VectorStore = Depends(get_vector_store),
    cache: CacheProvider = Depends(get_cache_provider),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> ImportScopeApplyResponse:
    binding = await _get_binding_or_404(session, notebook_id=notebook_id, binding_id=binding_id)
    plugin = _get_connector_plugin_or_409(binding.connector_id, plugins=plugins)
    if not plugin.supports_snapshot:
        raise HTTPException(status_code=400, detail="Connector does not support snapshot")

    directories, files = _normalize_import_scope(payload)
    normalized_scope = ImportScope(
        include_directories=directories or None,
        include_files=files or None,
    )

    snapshot = await _build_snapshot(plugin, settings=settings, connection_config=binding.connection_config)
    selected_entries = [
        entry
        for entry in snapshot.entries
        if path_in_scope(entry.relative_path, include_directories=directories, include_files=files)
    ]

    results: list[ImportResultItem] = []
    imported_source_ids: list[int] = []
    reused_source_ids: list[int] = []
    vectors_changed = False

    for entry in selected_entries:
        try:
            raw = await plugin.read_file_bytes(
                settings,
                connection_config=binding.connection_config,
                relative_path=entry.relative_path,
            )
        except Exception as exc:  # noqa: BLE001 - plugin boundary
            results.append(
                ImportResultItem(
                    relative_path=entry.relative_path,
                    status="failed",
                    source_id=None,
                    diagnostic=Diagnostic(
                        error_code="CONNECTOR_READ_FAILED",
                        message="读取文件失败",
                        hint="检查连接参数与文件权限，或查看后端日志。",
                        details={"error": type(exc).__name__, "message": str(exc)[:512]},
                    ),
                )
            )
            continue

        if not raw:
            results.append(
                ImportResultItem(
                    relative_path=entry.relative_path,
                    status="skipped",
                    source_id=None,
                    diagnostic=Diagnostic(
                        error_code="EMPTY_DOCUMENT",
                        message="空文档，已跳过",
                        hint="请检查文件内容是否为空。",
                    ),
                )
            )
            continue

        dedup_digest = hashlib.sha256(raw).hexdigest()
        dedup_key = f"connector:{binding.connector_id}:sha256:{dedup_digest}"

        if settings.source_ingestion.dedup.enabled:
            existing_source = await session.scalar(
                select(Source)
                .where(Source.notebook_id == notebook_id, Source.dedup_key == dedup_key)
                .order_by(Source.created_at.desc())
            )
            if existing_source is not None:
                reused_source_ids.append(existing_source.id)
                results.append(
                    ImportResultItem(
                        relative_path=entry.relative_path,
                        status="reused",
                        source_id=existing_source.id,
                        diagnostic=None,
                    )
                )
                continue

        connector_metadata: JsonDict = {
            "connector_id": binding.connector_id,
            "binding_id": binding.id,
            "relative_path": entry.relative_path,
            "snapshot_entry": entry.model_dump(mode="json", exclude_none=True),
        }
        imported, diag = await _ingest_source_bytes(
            notebook_id=notebook_id,
            filename=entry.relative_path,
            mime_type="text/markdown" if entry.relative_path.lower().endswith((".md", ".markdown")) else None,
            raw=raw,
            session=session,
            settings=settings,
            embedder=embedder,
            transcriber=transcriber,
            vector_store=vector_store,
            plugins=plugins,
            connector_metadata=connector_metadata,
            dedup_key=dedup_key,
        )

        if imported is None:
            results.append(
                ImportResultItem(
                    relative_path=entry.relative_path,
                    status="skipped" if diag and diag.error_code in {"PARSER_PLUGIN_REQUIRED", "UNSUPPORTED_FILE_TYPE"} else "failed",
                    source_id=None,
                    diagnostic=diag,
                )
            )
            continue

        if diag is not None:
            results.append(
                ImportResultItem(
                    relative_path=entry.relative_path,
                    status="failed",
                    source_id=imported.id,
                    diagnostic=diag,
                )
            )
            continue

        imported_source_ids.append(imported.id)
        vectors_changed = True
        results.append(
            ImportResultItem(
                relative_path=entry.relative_path,
                status="imported",
                source_id=imported.id,
                diagnostic=None,
            )
        )

    binding.import_scope = cast(JsonDict, normalized_scope.model_dump(mode="json", exclude_none=True))
    if imported_source_ids or reused_source_ids:
        binding.last_confirmed_snapshot = cast(JsonDict, snapshot.model_dump(mode="json", exclude_none=True))
        binding.last_sync_check_result = None
    session.add(binding)
    await session.commit()
    await session.refresh(binding)

    if vectors_changed:
        await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id, vectors_changed=True)

    return ImportScopeApplyResponse(
        binding=ConnectorBindingRead.model_validate(binding, from_attributes=True),
        imported_source_ids=imported_source_ids,
        reused_source_ids=reused_source_ids,
        results=results,
    )
