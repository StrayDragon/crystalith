from __future__ import annotations

import asyncio
import datetime
from time import perf_counter
from typing import Any

from cl_logs import get_logger
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.agents.search_graph import run_search_graph
from crystalith.shared.ai.interfaces import EmbeddingProvider
from crystalith.shared.cache import CacheProvider
from crystalith.shared.config import Settings
from crystalith.shared.db import Chunk, Notebook, Source
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
from crystalith.shared.types import SourceStatus
from crystalith.shared.vector_storage import VectorStore
from crystalith.shared.parsers import TranscriptionProvider
from crystalith.shared.net import UrlSafetyError, validate_url_for_fetch

from .api_common import (
    _build_source_metadata,
    _invalidate_notebook_source_caches,
    _page_count_from_chunks,
    _resolve_parser,
    _source_to_read,
)
from .api_schemas import (
    ExtractorInfoResponse,
    ExtractorsListResponse,
    SourceFromUrlMode,
    SourceFromUrlRequest,
    SourceRead,
    SourceSearchRequest,
    SourceSearchResponse,
    SourceSearchResult,
    SourceSearchStatus,
)

logger = get_logger(__name__)

router = APIRouter()


@router.get("/extractors", response_model=ExtractorsListResponse)
async def list_extractors(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
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
    factory = ExtractorFactory(
        web_extraction_settings,
        url_fetch_security=settings.source_ingestion.url_fetch.security,
    )

    extractor_infos = factory.get_available_extractors()

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
                enabled=info.enabled,
                available=info.available,
                display_name=info.display_name,
                description=info.description,
                priority=info.priority,
                requires_api_key=info.requires_api_key,
                requires_service=info.requires_service,
            )
            for info in extractor_infos
        ],
        default_extractor=default_extractor,
        fallback_enabled=web_extraction_settings.enable_fallback,
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
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    vector_store: VectorStore = Depends(get_vector_store),
    settings: Settings = Depends(get_settings),
    cache: CacheProvider = Depends(get_cache_provider),
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

    url = payload.url
    title = payload.title or url
    snippet = payload.snippet or ""
    extraction_metadata: dict[str, Any] = {}

    if payload.mode == SourceFromUrlMode.LINK:
        # Link mode: create a simple source with URL metadata
        content_text = f"# {title}\n\n{snippet}\n\n来源: {url}"
        chunks = [
            type("Chunk", (), {
                "text": content_text,
                "start_offset": 0,
                "end_offset": len(content_text),
                "metadata": {"url": url, "title": title},
            })()
        ]
        parser_type = "link"
        parse_time_ms = 0
    else:
        # Fetch mode: use the extraction system
        from crystalith.shared.ai.retry import run_with_retry
        from crystalith.shared.extraction import (
            ExtractionError,
            ExtractorFactory,
            NetworkError,
            ServiceUnavailableError,
        )
        from crystalith.shared.extraction.types import ExtractorType
        from crystalith.shared.utils.chunker import chunk_text

        web_extraction_settings = settings.source_ingestion.web_extraction
        url_fetch_security = settings.source_ingestion.url_fetch.security

        # Create extractor factory
        factory = ExtractorFactory(
            web_extraction_settings,
            url_fetch_security=url_fetch_security,
        )

        try:
            await validate_url_for_fetch(url, policy=url_fetch_security)
        except UrlSafetyError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        # Determine preferred extractor
        preferred_extractor: ExtractorType | None = None
        if payload.extractor:
            try:
                preferred_extractor = ExtractorType(payload.extractor)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"无效的提取器类型: {payload.extractor}",
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
            raise HTTPException(
                status_code=400,
                detail=f"无法提取网页内容: {exc.message}",
            ) from exc
        except Exception as exc:
            logger.exception(
                "Unexpected extraction error",
                url=url,
            )
            raise HTTPException(
                status_code=500,
                detail=f"提取过程发生错误: {exc!s}",
            ) from exc

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
        extraction_metadata = extracted.to_metadata()

    # Create the source record
    source = Source(
        notebook_id=notebook_id,
        filename=title[:255],  # Truncate if too long
        mime_type="text/html",
        parser_type=parser_type,
        status=SourceStatus.PROCESSING,
    )
    session.add(source)
    await session.commit()
    await session.refresh(source)

    try:
        # Build metadata
        page_count = None
        source.metadata_ = _build_source_metadata(
            chunks,
            parser_type=parser_type,
            parse_time_ms=parse_time_ms,
            page_count=page_count,
        )
        source.metadata_["url"] = url
        if payload.title:
            source.metadata_["original_title"] = payload.title

        # Add extraction metadata
        if extraction_metadata:
            source.metadata_.update(extraction_metadata)

        # Embed chunks
        embeddings = await embedder.embed_batch([chunk.text for chunk in chunks])
        if len(embeddings) != len(chunks):
            raise ValueError("embedding count mismatch")

        # Create chunk records
        chunk_models: list[Chunk] = []
        for index, chunk in enumerate(chunks):
            chunk_model = Chunk(
                source_id=source.id,
                chunk_index=index,
                text=chunk.text,
                start_offset=chunk.start_offset,
                end_offset=chunk.end_offset,
                metadata_=chunk.metadata if hasattr(chunk, "metadata") else None,
            )
            session.add(chunk_model)
            chunk_models.append(chunk_model)

        await session.flush()
        chunk_ids = [chunk.id for chunk in chunk_models]

        source.status = SourceStatus.READY
        source.error_message = None
        await session.commit()
        await session.refresh(source)

        # Add to vector store
        await vector_store.add(
            notebook_id=notebook_id,
            source_id=source.id,
            chunk_ids=chunk_ids,
            vectors=embeddings,
        )
    except HTTPException:
        await session.rollback()
        raise
    except Exception as exc:
        await session.rollback()
        source.status = SourceStatus.FAILED
        error_detail = str(exc)[:512]
        source.error_message = error_detail
        session.add(source)
        await session.commit()
        # Log with Rich exception traceback
        logger.exception(
            "Source ingestion failed for URL",
            url=url,
            error=error_detail,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Ingestion failed: {error_detail}",
        ) from exc

    await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id, vectors_changed=True)
    return _source_to_read(source, chunk_count=len(chunk_models))


@router.post("", response_model=SourceRead, status_code=status.HTTP_201_CREATED)
async def upload_source(
    notebook_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    transcriber: TranscriptionProvider = Depends(get_transcription_provider),
    vector_store: VectorStore = Depends(get_vector_store),
    cache: CacheProvider = Depends(get_cache_provider),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> SourceRead:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    parser = _resolve_parser(file, transcriber, plugins)
    filename = file.filename or "upload.txt"
    mime_type = file.content_type

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty document")

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
        parse_started = perf_counter()
        loop = asyncio.get_running_loop()
        chunks = await loop.run_in_executor(None, parser.parse, raw)
        parse_time_ms = int((perf_counter() - parse_started) * 1000)
        if not chunks:
            await session.delete(source)
            await session.commit()
            raise HTTPException(status_code=400, detail="empty document")

        page_count = getattr(parser, "page_count", None)
        if page_count is None:
            page_count = _page_count_from_chunks(chunks)
        source.metadata_ = _build_source_metadata(
            chunks,
            parser_type=parser.parser_type,
            parse_time_ms=parse_time_ms,
            page_count=page_count,
        )

        embeddings = await embedder.embed_batch([chunk.text for chunk in chunks])
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
    except HTTPException:
        await session.rollback()
        raise
    except Exception as exc:
        await session.rollback()
        source.status = SourceStatus.FAILED
        error_detail = str(exc)[:512]
        source.error_message = error_detail
        session.add(source)
        await session.commit()
        # Log with Rich exception traceback
        logger.exception(
            "Source upload ingestion failed",
            filename=file.filename,
            error=error_detail,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Ingestion failed: {error_detail}",
        ) from exc

    await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id, vectors_changed=True)
    return _source_to_read(source, chunk_count=len(chunk_ids))
