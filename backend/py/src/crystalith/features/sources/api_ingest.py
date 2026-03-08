from __future__ import annotations

import asyncio
import datetime
import hashlib
from time import perf_counter
from typing import Literal, cast

from cl_logs import get_logger
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.agents.search_graph import run_search_graph
from crystalith.shared.ai.interfaces import EmbeddingProvider
from crystalith.shared.cache import CacheProvider
from crystalith.shared.config import Settings
from crystalith.shared.db import Chunk as ChunkModel, Notebook, NotebookExtractorPolicy, Source
from crystalith.shared.deps import (
    get_cache_provider,
    get_db_session,
    get_embedding_provider,
    get_plugin_registry,
    get_settings,
    get_transcription_provider,
    get_vector_store,
)
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.json_types import JsonDict, JsonValue
from crystalith.shared.types import SourceStatus
from crystalith.shared.vector_storage import VectorStore
from crystalith.shared.parsers import TranscriptionProvider
from crystalith.shared.parsers.interfaces import ParserWithDocumentMetadata
from crystalith.shared.net import UrlSafetyError, canonicalize_url_for_dedup, validate_url_for_fetch

from .api_common import (
    _build_source_metadata,
    _invalidate_notebook_source_caches,
    _load_tag_names_for_sources,
    _page_count_from_chunks,
    _resolve_parser,
    _source_to_read,
)
from .api_schemas import (
    ExtractorInfoResponse,
    ExtractorsListResponse,
    ExtractorPolicyMode,
    NotebookExtractorsPolicy,
    PatchNotebookExtractorsPolicyRequest,
    SourceFromUrlMode,
    SourceFromUrlRequest,
    SourceRead,
    SourceSearchRequest,
    SourceSearchResponse,
    SourceSearchResult,
    SourceSearchStatus,
)
from crystalith.shared.source_diagnostics import (
    SOURCE_ERROR_EMBEDDING_FAILED,
    SOURCE_ERROR_EXTRACTOR_FAILED,
    SOURCE_ERROR_EXTRACTOR_TIMEOUT,
    SOURCE_ERROR_INGESTION_FAILED,
    SOURCE_ERROR_OPTIONAL_SERVICE_UNAVAILABLE,
    SOURCE_ERROR_PARSER_FAILED,
    SOURCE_ERROR_URL_FETCH_BLOCKED,
    SOURCE_ERROR_VECTOR_STORE_FAILED,
    SourceFailure,
    apply_source_failure,
    raise_source_failure,
)

logger = get_logger(__name__)

router = APIRouter()


@router.get("/extractors", response_model=ExtractorsListResponse)
async def list_extractors(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> ExtractorsListResponse:
    """List available web content extractors.

    Returns information about all configured extractors, including:
    - Whether they are enabled in configuration
    - Whether they are actually available (dependencies installed, service reachable)
    - Display name and description
    - Priority order for fallback

    The frontend can use this to show users which extraction methods are available
    and let them choose a preferred method.
    """
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    from crystalith.shared.extraction import ExtractorFactory

    web_extraction_settings = settings.source_ingestion.web_extraction
    policy_row = await session.get(NotebookExtractorPolicy, notebook_id)
    policy_mode_raw = (policy_row.mode if policy_row is not None else "inherit_global") or "inherit_global"
    enabled_extractors = list(policy_row.enabled_extractors or []) if policy_row is not None else []
    policy_mode: ExtractorPolicyMode
    if policy_mode_raw in {"inherit_global", "custom"}:
        policy_mode = cast(ExtractorPolicyMode, policy_mode_raw)
    else:
        policy_mode = "inherit_global"
        enabled_extractors = []
    enabled_set = set(enabled_extractors) if policy_mode == "custom" else set()
    factory = ExtractorFactory(
        settings,
        plugins=plugins,
        url_fetch_security=settings.source_ingestion.url_fetch.security,
        policy_mode=policy_mode,
        enabled_extractors=enabled_set,
    )

    extractor_infos = await factory.get_available_extractors()

    # Find the default (first available) extractor
    default_extractor: str | None = None
    for info in extractor_infos:
        if info.available:
            default_extractor = info.type.value
            break

    return ExtractorsListResponse(
        extractors=[
            ExtractorInfoResponse(
                type=info.type.value,
                plugin_id=info.plugin_id,
                enabled=info.enabled,
                available=info.available,
                display_name=info.display_name,
                description=info.description,
                priority=info.priority,
                requires_api_key=info.requires_api_key,
                requires_service=info.requires_service,
                error_code=info.error_code,
                message=info.message,
                recovery_hint=info.recovery_hint,
                details=cast(JsonDict, info.details) if isinstance(info.details, dict) else None,
            )
            for info in extractor_infos
        ],
        default_extractor=default_extractor,
        fallback_enabled=web_extraction_settings.enable_fallback,
        policy=NotebookExtractorsPolicy(mode=policy_mode, enabled_extractors=sorted(enabled_extractors)),
    )


@router.patch("/extractors", response_model=ExtractorsListResponse)
async def patch_extractors_policy(
    notebook_id: int,
    payload: PatchNotebookExtractorsPolicyRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> ExtractorsListResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    valid_extractors = {"trafilatura", "jina", "firecrawl", "browserless"}

    policy_row = await session.get(NotebookExtractorPolicy, notebook_id)
    if policy_row is None:
        policy_row = NotebookExtractorPolicy(
            notebook_id=notebook_id,
            mode="inherit_global",
            enabled_extractors=[],
        )
        session.add(policy_row)

    if payload.mode is not None:
        next_mode = payload.mode
        if next_mode not in {"inherit_global", "custom"}:
            raise HTTPException(status_code=400, detail="Invalid extractor policy mode")

        if next_mode == "custom" and policy_row.mode != "custom" and payload.enabled_extractors is None:
            # Initialize custom enabled set from current global policy.
            enabled_from_global: list[str] = []
            web_settings = settings.source_ingestion.web_extraction
            if web_settings.trafilatura.enabled:
                enabled_from_global.append("trafilatura")
            if web_settings.jina.enabled:
                enabled_from_global.append("jina")
            if web_settings.firecrawl.enabled:
                enabled_from_global.append("firecrawl")
            if web_settings.browserless.enabled:
                enabled_from_global.append("browserless")
            policy_row.enabled_extractors = enabled_from_global

        policy_row.mode = next_mode

    if payload.enabled_extractors is not None:
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in payload.enabled_extractors:
            value = str(raw or "").strip().lower()
            if not value or value in seen:
                continue
            if value not in valid_extractors:
                raise HTTPException(status_code=400, detail=f"Invalid extractor type: {value}")
            normalized.append(value)
            seen.add(value)
        policy_row.enabled_extractors = normalized

    await session.commit()

    # Return the updated view.
    web_extraction_settings = settings.source_ingestion.web_extraction
    policy_mode_raw = policy_row.mode or "inherit_global"
    policy_mode: ExtractorPolicyMode = (
        cast(ExtractorPolicyMode, policy_mode_raw)
        if policy_mode_raw in {"inherit_global", "custom"}
        else "inherit_global"
    )
    enabled_extractors = list(policy_row.enabled_extractors or [])
    enabled_set = set(enabled_extractors) if policy_mode == "custom" else set()

    from crystalith.shared.extraction import ExtractorFactory

    factory = ExtractorFactory(
        settings,
        plugins=plugins,
        url_fetch_security=settings.source_ingestion.url_fetch.security,
        policy_mode=policy_mode,
        enabled_extractors=enabled_set,
    )
    extractor_infos = await factory.get_available_extractors()

    default_extractor: str | None = None
    for info in extractor_infos:
        if info.available:
            default_extractor = info.type.value
            break

    return ExtractorsListResponse(
        extractors=[
            ExtractorInfoResponse(
                type=info.type.value,
                plugin_id=info.plugin_id,
                enabled=info.enabled,
                available=info.available,
                display_name=info.display_name,
                description=info.description,
                priority=info.priority,
                requires_api_key=info.requires_api_key,
                requires_service=info.requires_service,
                error_code=info.error_code,
                message=info.message,
                recovery_hint=info.recovery_hint,
                details=cast(JsonDict, info.details) if isinstance(info.details, dict) else None,
            )
            for info in extractor_infos
        ],
        default_extractor=default_extractor,
        fallback_enabled=web_extraction_settings.enable_fallback,
        policy=NotebookExtractorsPolicy(mode=policy_mode, enabled_extractors=sorted(enabled_extractors)),
    )


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
    result = await run_search_graph(
        query=payload.query,
        engine=payload.engine,
        mode=payload.mode,
        deps=deps,
    )
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
        message=message or "",
        created_at=created_at,
    )


@router.post("/from-url", response_model=SourceRead, status_code=status.HTTP_201_CREATED)
async def create_source_from_url(
    notebook_id: int,
    payload: SourceFromUrlRequest,
    response: Response,
    dedup_action: Literal["prompt", "reuse", "create_new"] = "prompt",
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    vector_store: VectorStore = Depends(get_vector_store),
    settings: Settings = Depends(get_settings),
    cache: CacheProvider = Depends(get_cache_provider),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> SourceRead:
    """Create a source from a URL.

    Supports two modes:
    - `link`: Save URL, title, and snippet as a lightweight source
    - `fetch`: Fetch the webpage content and parse it as a full source

    For `fetch` mode, you can optionally specify an extractor:
    - `trafilatura`: Local extraction using trafilatura library (default)
    - `firecrawl`: External API using Firecrawl service
    - `browserless`: Browser rendering using Browserless + Playwright
    """
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    url = payload.url.strip()
    canonical_url = canonicalize_url_for_dedup(url)
    url_digest = hashlib.sha256(canonical_url.encode("utf-8")).hexdigest()
    dedup_key = f"url:sha256:{url_digest}"

    if settings.source_ingestion.dedup.enabled:
        existing_source = await session.scalar(
            select(Source)
            .where(Source.notebook_id == notebook_id, Source.dedup_key == dedup_key)
            .order_by(Source.created_at.desc())
        )
        if existing_source is not None and dedup_action != "create_new":
            if dedup_action == "reuse":
                response.status_code = status.HTTP_200_OK
                chunk_count = await session.scalar(
                    select(func.count(ChunkModel.id)).where(ChunkModel.source_id == existing_source.id)
                )
                tags_by_source = await _load_tag_names_for_sources(session, source_ids=[existing_source.id])
                return _source_to_read(
                    existing_source,
                    chunk_count=int(chunk_count or 0),
                    tags=tags_by_source.get(existing_source.id, []),
                )
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": "SOURCE_DEDUP_HIT",
                    "message": "检测到重复来源",
                    "details": {
                        "existing_source_id": existing_source.id,
                        "existing_filename": existing_source.filename,
                        "existing_status": existing_source.status.value,
                        "recovery_hint": "你可以复用已有来源，或选择仍创建新来源。",
                    },
                },
            )

    title = payload.title or url
    snippet = payload.snippet or ""
    extraction_metadata: JsonDict = {}

    from crystalith.shared.utils.chunker import ChunkPayload, chunk_text

    if payload.mode == SourceFromUrlMode.LINK:
        # Link mode: create a simple source with URL metadata
        content_text = f"# {title}\n\n{snippet}\n\n来源: {url}"
        payload_metadata: JsonDict = {"url": url, "canonical_url": canonical_url, "title": title}
        chunks: list[ChunkPayload] = [
            ChunkPayload(
                text=content_text,
                start_offset=0,
                end_offset=len(content_text),
                metadata=payload_metadata,
            )
        ]
        parser_type = "link"
        parse_time_ms = 0
    else:
        # Fetch mode: use the extraction system
        from crystalith.shared.ai.retry import run_with_retry
        from crystalith.shared.extraction import (
            ConfigurationError,
            ExtractionError,
            ExtractorFactory,
            NetworkError,
            ServiceUnavailableError,
        )
        from crystalith.shared.extraction.types import ExtractorType

        web_extraction_settings = settings.source_ingestion.web_extraction
        url_fetch_security = settings.source_ingestion.url_fetch.security
        policy_row = await session.get(NotebookExtractorPolicy, notebook_id)
        policy_mode = (policy_row.mode if policy_row is not None else "inherit_global") or "inherit_global"
        enabled_extractors = list(policy_row.enabled_extractors or []) if policy_row is not None else []
        if policy_mode not in {"inherit_global", "custom"}:
            policy_mode = "inherit_global"
            enabled_extractors = []
        enabled_set = set(enabled_extractors) if policy_mode == "custom" else set()

        # Create extractor factory (extractors are provided by plugins)
        factory = ExtractorFactory(
            settings,
            plugins=plugins,
            url_fetch_security=url_fetch_security,
            policy_mode=policy_mode,
            enabled_extractors=enabled_set,
        )

        try:
            await validate_url_for_fetch(url, policy=url_fetch_security)
        except UrlSafetyError as exc:
            raise_source_failure(
                SourceFailure(
                    error_code=SOURCE_ERROR_URL_FETCH_BLOCKED,
                    message=str(exc),
                    recovery_hint="该 URL 被 SSRF 安全策略阻止。请使用公开的 http(s) URL，或在配置中加入 allowlist。",
                    status_code=400,
                )
            )

        # Determine preferred extractor
        preferred_extractor: ExtractorType | None = None
        if payload.extractor:
            try:
                preferred_extractor = ExtractorType(payload.extractor)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"无效的提取器类型: {payload.extractor}",
                ) from None

        # Fail fast when no extractors are enabled for this notebook.
        enabled_extractors = [
            ext_type
            for ext_type in factory.get_fallback_order()
            if factory.get_extractor(ext_type).extractor is not None
        ]
        if not enabled_extractors:
            if policy_mode == "custom":
                hint = "该 notebook 当前使用 custom 策略但未启用任何提取器。请在 UI 中启用提取器，或切换为 inherit_global。"
            else:
                hint = "未安装或未启用任何网页提取器插件。安装 crystalith[official-full]（推荐）或安装并启用 extractor-* 官方插件。"
            raise_source_failure(
                SourceFailure(
                    error_code=SOURCE_ERROR_OPTIONAL_SERVICE_UNAVAILABLE,
                    message="没有可用的网页提取器",
                    recovery_hint=hint,
                    status_code=503,
                    details={
                        "policy_mode": policy_mode,
                        "enabled_extractors": [item.value for item in enabled_extractors],
                    },
                )
            )

        # Preferred extractor diagnostics (for user-actionable errors or metadata).
        preferred_diagnostic: JsonDict | None = None
        if preferred_extractor is not None:
            preferred_state = factory.get_extractor(preferred_extractor)
            preferred_error_code = preferred_state.error_code
            preferred_message = preferred_state.message
            preferred_hint = preferred_state.recovery_hint
            preferred_details = preferred_state.details

            preferred_available = False
            if preferred_state.extractor is not None:
                try:
                    preferred_available = await preferred_state.extractor.is_available()
                except Exception:  # noqa: BLE001 - extractor boundary
                    preferred_available = False

            if preferred_state.extractor is None or not preferred_available:
                if preferred_error_code is None:
                    preferred_error_code = "unavailable"
                if preferred_message is None:
                    preferred_message = "Preferred extractor is unavailable"
                if preferred_hint is None:
                    preferred_hint = "检查提取器配置（API key / 服务地址）与网络连通性，或启用 fallback。"

                preferred_details_payload: JsonValue | None = None
                if preferred_details is not None:
                    preferred_details_payload = cast(JsonValue, dict(preferred_details))
                preferred_diagnostic = {
                    "error_code": preferred_error_code,
                    "message": preferred_message,
                    "recovery_hint": preferred_hint,
                    "details": preferred_details_payload,
                }

                if not web_extraction_settings.enable_fallback:
                    raise_source_failure(
                        SourceFailure(
                            error_code=SOURCE_ERROR_OPTIONAL_SERVICE_UNAVAILABLE,
                            message=f"提取器不可用: {preferred_extractor.value}",
                            recovery_hint=preferred_hint,
                            status_code=503,
                            details={
                                "preferred_extractor": preferred_extractor.value,
                                "diagnostic": preferred_diagnostic,
                            },
                        )
                    )

        # Extract content
        async def _extract_once():
            return await factory.extract(
                url,
                preferred_extractor=preferred_extractor,
                enable_fallback=web_extraction_settings.enable_fallback,
            )

        def _is_retryable_extraction_error(error: Exception) -> bool:
            if isinstance(error, (NetworkError, ServiceUnavailableError, TimeoutError, asyncio.TimeoutError)):
                return True
            if isinstance(error, ExtractionError):
                message = error.message.lower()
                return (
                    "timeout" in message
                    or "temporarily unavailable" in message
                    or "connection" in message
                )
            return False

        try:
            extracted = await run_with_retry(
                _extract_once,
                timeout=None,
                max_retries=settings.ai.max_retries,
                retry_if=_is_retryable_extraction_error,
            )
        except ExtractionError as exc:
            logger.warning(
                "Content extraction failed",
                url=url,
                error=str(exc),
            )
            error_code = SOURCE_ERROR_EXTRACTOR_FAILED
            status_code = 400
            hint = "尝试切换提取器，或检查 URL 是否需要登录/反爬限制。"
            if isinstance(exc, (NetworkError, ServiceUnavailableError, ConfigurationError)):
                error_code = SOURCE_ERROR_OPTIONAL_SERVICE_UNAVAILABLE
                status_code = 503
                hint = "检查网络连通性与提取器配置（API key / 服务地址），或稍后重试。"
            if "timeout" in exc.message.lower():
                error_code = SOURCE_ERROR_EXTRACTOR_TIMEOUT
                status_code = 503
                hint = "网页提取超时。可稍后重试或切换提取器。"
            raise_source_failure(
                SourceFailure(
                    error_code=error_code,
                    message=f"无法提取网页内容: {exc.message}",
                    recovery_hint=hint,
                    status_code=status_code,
                    details={"extractor": exc.extractor, "url": exc.url},
                )
            )
        except Exception as exc:
            logger.exception(
                "Unexpected extraction error",
                url=url,
            )
            raise_source_failure(
                SourceFailure(
                    error_code=SOURCE_ERROR_EXTRACTOR_FAILED,
                    message="提取过程发生错误",
                    recovery_hint="可稍后重试，或尝试切换提取器。",
                    status_code=500,
                    details=str(exc)[:512],
                )
            )

        # Update title from extraction if available
        if extracted.title and not payload.title:
            title = extracted.title

        # Chunk the extracted text in executor to avoid blocking event loop
        loop = asyncio.get_running_loop()
        chunks = await loop.run_in_executor(None, chunk_text, extracted.text)

        if not chunks:
            raise HTTPException(status_code=400, detail="网页中未提取到有效内容")

        parse_time_ms = extracted.extraction_time_ms
        parser_type = f"web:{extracted.extractor}"

        # Store extraction metadata
        extraction_metadata = cast(JsonDict, extracted.to_metadata())
        if preferred_extractor is not None:
            extraction_metadata["preferred_extractor"] = preferred_extractor.value
        if preferred_diagnostic is not None:
            extraction_metadata["preferred_extractor_diagnostic"] = preferred_diagnostic
        if preferred_extractor is not None and extracted.extractor != preferred_extractor.value:
            extraction_metadata["fallback_extractor"] = extracted.extractor
            extraction_metadata["fallback_used"] = True

    # Create the source record
    source = Source(
        notebook_id=notebook_id,
        filename=title[:255],  # Truncate if too long
        mime_type="text/html",
        parser_type=parser_type,
        dedup_key=dedup_key,
        status=SourceStatus.PROCESSING,
    )
    session.add(source)
    await session.commit()
    await session.refresh(source)

    stage: str = "metadata"
    try:
        # Build metadata
        stage = "metadata"
        page_count = None
        metadata = _build_source_metadata(
            chunks,
            parser_type=parser_type,
            parser_plugin_id=None,
            parse_time_ms=parse_time_ms,
            page_count=page_count,
        )
        metadata["url"] = url
        metadata["canonical_url"] = canonical_url
        if payload.title:
            metadata["original_title"] = payload.title

        # Add extraction metadata
        if extraction_metadata:
            metadata.update(extraction_metadata)
        source.metadata_ = metadata

        # Embed chunks
        stage = "embed"
        embeddings = await embedder.embed_batch([chunk.text for chunk in chunks])
        if len(embeddings) != len(chunks):
            raise ValueError("embedding count mismatch")

        # Create chunk records
        stage = "chunks"
        chunk_models: list[ChunkModel] = []
        for index, chunk in enumerate(chunks):
            chunk_model = ChunkModel(
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

        # Add to vector store
        stage = "vector_store"
        await vector_store.add(
            notebook_id=notebook_id,
            source_id=source.id,
            chunk_ids=chunk_ids,
            vectors=embeddings,
        )

        await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id, vectors_changed=True)
        return _source_to_read(source, chunk_count=len(chunk_ids))
    except HTTPException:
        await session.rollback()
        raise
    except Exception as exc:
        await session.rollback()
        if stage == "embed":
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
        # Log with Rich exception traceback
        logger.exception(
            "Source ingestion failed for URL",
            url=url,
            error=str(exc)[:512],
        )
        raise_source_failure(failure)


@router.post("", response_model=SourceRead, status_code=status.HTTP_201_CREATED)
async def upload_source(
    notebook_id: int,
    response: Response,
    file: UploadFile = File(...),
    dedup_action: Literal["prompt", "reuse", "create_new"] = "prompt",
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    transcriber: TranscriptionProvider = Depends(get_transcription_provider),
    vector_store: VectorStore = Depends(get_vector_store),
    cache: CacheProvider = Depends(get_cache_provider),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> SourceRead:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    parser_resolution = _resolve_parser(file, transcriber, plugins)
    parser = parser_resolution.parser
    filename = file.filename or "upload.txt"
    mime_type = file.content_type

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty document")

    dedup_digest = hashlib.sha256(raw).hexdigest()
    dedup_key = f"upload:sha256:{dedup_digest}"

    if settings.source_ingestion.dedup.enabled:
        existing_source = await session.scalar(
            select(Source)
            .where(Source.notebook_id == notebook_id, Source.dedup_key == dedup_key)
            .order_by(Source.created_at.desc())
        )
        if existing_source is not None and dedup_action != "create_new":
            if dedup_action == "reuse":
                response.status_code = status.HTTP_200_OK
                chunk_count = await session.scalar(
                    select(func.count(ChunkModel.id)).where(ChunkModel.source_id == existing_source.id)
                )
                tags_by_source = await _load_tag_names_for_sources(session, source_ids=[existing_source.id])
                return _source_to_read(
                    existing_source,
                    chunk_count=int(chunk_count or 0),
                    tags=tags_by_source.get(existing_source.id, []),
                )
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": "SOURCE_DEDUP_HIT",
                    "message": "检测到重复来源",
                    "details": {
                        "existing_source_id": existing_source.id,
                        "existing_filename": existing_source.filename,
                        "existing_status": existing_source.status.value,
                        "recovery_hint": "你可以复用已有来源，或选择仍创建新来源。",
                    },
                },
            )

    source = Source(
        notebook_id=notebook_id,
        filename=filename,
        mime_type=mime_type,
        parser_type=parser.parser_type,
        dedup_key=dedup_key,
        status=SourceStatus.PROCESSING,
    )
    session.add(source)
    await session.commit()
    await session.refresh(source)

    stage = "parse"
    try:
        parse_started = perf_counter()
        loop = asyncio.get_running_loop()
        stage = "parse"
        chunks = await loop.run_in_executor(None, parser.parse, raw)
        parse_time_ms = int((perf_counter() - parse_started) * 1000)
        if not chunks:
            await session.delete(source)
            await session.commit()
            raise HTTPException(status_code=400, detail="empty document")

        page_count = parser.page_count
        if page_count is None:
            page_count = _page_count_from_chunks(chunks)
        source_metadata = _build_source_metadata(
            chunks,
            parser_type=parser.parser_type,
            parser_plugin_id=parser_resolution.parser_plugin_id,
            parse_time_ms=parse_time_ms,
            page_count=page_count,
        )
        if isinstance(parser, ParserWithDocumentMetadata) and parser.document_metadata:
            source_metadata = {**source_metadata, **parser.document_metadata}
        source.metadata_ = source_metadata

        stage = "embed"
        embeddings = await embedder.embed_batch([chunk.text for chunk in chunks])
        if len(embeddings) != len(chunks):
            raise ValueError("embedding count mismatch")

        stage = "chunks"
        chunk_models: list[ChunkModel] = []
        for index, chunk in enumerate(chunks):
            chunk_model = ChunkModel(
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

        await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id, vectors_changed=True)
        return _source_to_read(source, chunk_count=len(chunk_ids))
    except HTTPException:
        await session.rollback()
        raise
    except Exception as exc:
        await session.rollback()
        if stage == "parse":
            failure = SourceFailure(
                error_code=SOURCE_ERROR_PARSER_FAILED,
                message="解析失败",
                recovery_hint="请检查文件格式与内容（支持 .txt/.md/.markdown/.pdf/.csv），或尝试将文件转换为可解析的文本后重新上传。",
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
        # Log with Rich exception traceback
        logger.exception(
            "Source upload ingestion failed",
            filename=file.filename,
            error=str(exc)[:512],
        )
        raise_source_failure(failure)
