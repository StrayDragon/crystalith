from __future__ import annotations

import datetime
from time import perf_counter
from typing import Any, Iterable, Literal

import httpx
from cl_logs import get_logger
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = get_logger(__name__)

from cl_stdx.enumx import MetaInfoStrEnum, XMetaInfo

from crystalith.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.ai.types import ChatMessage
from crystalith.agents.deps import StudioDeps
from crystalith.agents.search_graph import run_search_graph
from crystalith.config import Settings
from crystalith.db import Chunk, Notebook, Source, SourceStatus
from crystalith.parsers import Parser, ParserFactory, TranscriptionProvider, UnsupportedDocumentError
from crystalith.parsers.html import HTMLParser
from crystalith.vector_storage import VectorStore

from .deps import (
    get_chat_provider,
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


class SourceSearchStatus(MetaInfoStrEnum):
    """Status of a source search operation."""

    OK = "ok", XMetaInfo(description="搜索成功", display_text="成功")
    NOT_IMPLEMENTED = "not_implemented", XMetaInfo(description="功能未实现", display_text="未实现")


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


class SourceFromUrlMode(MetaInfoStrEnum):
    """Mode for creating source from URL."""

    FETCH = "fetch", XMetaInfo(description="获取完整内容", display_text="获取内容")
    LINK = "link", XMetaInfo(description="仅保存链接", display_text="保存链接")


class SourceFromUrlRequest(BaseModel):
    url: str = Field(..., min_length=1)
    title: str | None = Field(None)
    snippet: str | None = Field(None)
    mode: SourceFromUrlMode = Field(SourceFromUrlMode.LINK)

    @field_validator("url")
    @classmethod
    def _validate_url(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("url must not be empty")
        if not trimmed.startswith(("http://", "https://")):
            raise ValueError("url must start with http:// or https://")
        return trimmed




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
        message=message or "已生成简要搜索结果（TODO: 接入真实搜索）。",
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
) -> SourceRead:
    """Create a source from a URL.

    Supports two modes:
    - `link`: Save URL, title, and snippet as a lightweight source
    - `fetch`: Fetch the webpage content and parse it as a full source
    """
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    url = payload.url
    title = payload.title or url
    snippet = payload.snippet or ""

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
        # Fetch mode: download and parse the webpage
        # 从配置获取 URL 获取设置
        url_fetch_settings = settings.source_ingestion.url_fetch
        proxy_settings = url_fetch_settings.proxy

        # 使用浏览器伪装请求头
        browser_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }

        # 从配置获取超时和重试参数
        timeout = url_fetch_settings.timeout
        max_retries = url_fetch_settings.retry_count
        retry_delay = url_fetch_settings.retry_delay

        # 获取代理配置（如果启用且目标主机需要代理）
        from urllib.parse import urlparse
        parsed_url = urlparse(url)
        host = parsed_url.hostname or ""
        proxy_url = None
        if proxy_settings.should_proxy(host):
            proxy_url = proxy_settings.get_proxy_url()

        last_error: Exception | None = None
        content: bytes | None = None

        for attempt in range(max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=float(timeout),
                    follow_redirects=True,
                    headers=browser_headers,
                    proxy=proxy_url,
                ) as client:
                    response = await client.get(url)
                    response.raise_for_status()
                    content = response.content
                    break  # 成功，退出重试循环
            except httpx.HTTPStatusError as exc:
                last_error = exc
                error_detail = f"HTTP {exc.response.status_code}"
                # 4xx 错误不重试（客户端错误）
                if 400 <= exc.response.status_code < 500:
                    proxy_hint = "（代理已启用）" if proxy_url else "，可能需要配置代理"
                    raise HTTPException(
                        status_code=400,
                        detail=f"无法获取网页内容: {error_detail}。目标服务器拒绝了请求{proxy_hint}或网站有访问限制。",
                    ) from exc
            except httpx.RequestError as exc:
                last_error = exc
                # 网络错误可以重试
                if attempt < max_retries:
                    import asyncio
                    await asyncio.sleep(retry_delay)
                    continue

        if content is None:
            proxy_hint = "（代理已启用）" if proxy_url else "，或尝试配置代理"
            if last_error:
                if isinstance(last_error, httpx.HTTPStatusError):
                    raise HTTPException(
                        status_code=400,
                        detail=f"无法获取网页内容: HTTP {last_error.response.status_code}。请检查 URL 是否正确{proxy_hint}。",
                    ) from last_error
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"网络请求失败: {last_error!s}。请检查网络连接{proxy_hint}。",
                    ) from last_error
            raise HTTPException(status_code=400, detail="无法获取网页内容: 未知错误")

        parse_started = perf_counter()
        try:
            parser = HTMLParser()
            chunks = parser.parse(content)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"解析网页内容失败: {exc!s}",
            ) from exc
        parse_time_ms = int((perf_counter() - parse_started) * 1000)
        parser_type = "html"

        if not chunks:
            raise HTTPException(status_code=400, detail="网页中未提取到有效内容")

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

        # Embed chunks
        embeddings = await embedder.embed([chunk.text for chunk in chunks])
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

    return _source_to_read(source, chunk_count=len(chunk_models))


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


@router.delete("", response_model=SourceBatchDeleteResponse)
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


# --- Source Summary and QA endpoints ---


class SourceSummaryResponse(BaseModel):
    """Response for source summary."""

    source_id: int
    summary: str
    key_points: list[str]
    topics: list[str]
    word_count: int
    generated_at: datetime.datetime


class SourceQARequest(BaseModel):
    """Request for source-specific QA."""

    question: str = Field(..., min_length=1)


class SourceQAResponse(BaseModel):
    """Response for source-specific QA."""

    source_id: int
    answer: str
    created_at: datetime.datetime


SUMMARY_SYSTEM_PROMPT = """你是一个文档摘要助手。请根据提供的文档内容生成：
1. 一段简洁的摘要（2-3句话）
2. 4个关键要点（每个要点一句话）
3. 3个主题标签

请用中文回复，格式如下：
摘要：<摘要内容>
要点：
- <要点1>
- <要点2>
- <要点3>
- <要点4>
主题：<主题1>、<主题2>、<主题3>
"""

SOURCE_QA_SYSTEM_PROMPT = """你是一个基于文档的问答助手。请仅根据提供的文档内容回答用户的问题。
如果文档中没有相关信息，请明确说明"文档中未找到相关信息"。
请用中文回复，回答要简洁准确。"""


def _parse_summary_response(response: str) -> tuple[str, list[str], list[str]]:
    """Parse the summary response from the AI model."""
    lines = response.strip().split("\n")
    summary = ""
    key_points: list[str] = []
    topics: list[str] = []

    current_section = None
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith("摘要：") or line.startswith("摘要:"):
            summary = line.split("：", 1)[-1].split(":", 1)[-1].strip()
            current_section = "summary"
        elif line.startswith("要点：") or line.startswith("要点:"):
            current_section = "points"
        elif line.startswith("主题：") or line.startswith("主题:"):
            topics_str = line.split("：", 1)[-1].split(":", 1)[-1].strip()
            topics = [t.strip() for t in topics_str.replace("、", ",").split(",") if t.strip()]
            current_section = "topics"
        elif line.startswith("- ") and current_section == "points":
            key_points.append(line[2:].strip())
        elif current_section == "summary" and not summary:
            summary = line

    # Fallback if parsing failed
    if not summary:
        summary = response[:200].strip()
    if not key_points:
        key_points = ["核心概念和定义", "主要方法论", "实践案例分析", "建议和最佳实践"]
    if not topics:
        topics = ["分析", "方法论", "实践"]

    return summary, key_points[:4], topics[:3]


@router.get("/{source_id}/summary", response_model=SourceSummaryResponse)
async def get_source_summary(
    notebook_id: int,
    source_id: int,
    session: AsyncSession = Depends(get_db_session),
    chatter: ChatProvider = Depends(get_chat_provider),
) -> SourceSummaryResponse:
    """Generate or retrieve summary for a specific source."""
    source = await session.get(Source, source_id)
    if source is None or source.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Source not found")

    if source.status != SourceStatus.READY:
        raise HTTPException(status_code=400, detail="Source is not ready")

    # Get all chunks for this source
    result = await session.execute(
        select(Chunk)
        .where(Chunk.source_id == source_id)
        .order_by(Chunk.chunk_index.asc())
    )
    chunks = result.scalars().all()

    if not chunks:
        raise HTTPException(status_code=400, detail="Source has no content")

    # Calculate word count
    total_text = " ".join(chunk.text for chunk in chunks)
    word_count = len(total_text.split())

    # Prepare context for summary generation (limit to first few chunks)
    context_chunks = chunks[:10]  # Limit to first 10 chunks for summary
    context = "\n\n".join(
        f"[片段 {i + 1}]\n{chunk.text}"
        for i, chunk in enumerate(context_chunks)
    )

    # Generate summary using AI
    messages = [
        ChatMessage(role="system", content=SUMMARY_SYSTEM_PROMPT),
        ChatMessage(
            role="user",
            content=f"请为以下文档「{source.filename}」生成摘要：\n\n{context}",
        ),
    ]

    try:
        response = await chatter.chat(messages)
        summary, key_points, topics = _parse_summary_response(response)
    except Exception:
        # Fallback summary if AI fails
        summary = f"这是关于「{source.filename}」的文档，包含 {len(chunks)} 个片段。"
        key_points = ["核心概念和定义", "主要方法论", "实践案例分析", "建议和最佳实践"]
        topics = ["分析", "方法论", "实践"]

    return SourceSummaryResponse(
        source_id=source_id,
        summary=summary,
        key_points=key_points,
        topics=topics,
        word_count=word_count,
        generated_at=datetime.datetime.now(datetime.UTC),
    )


@router.post("/{source_id}/qa", response_model=SourceQAResponse)
async def source_qa(
    notebook_id: int,
    source_id: int,
    payload: SourceQARequest,
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    chatter: ChatProvider = Depends(get_chat_provider),
    vector_store: VectorStore = Depends(get_vector_store),
) -> SourceQAResponse:
    """Answer a question based on a specific source's content."""
    source = await session.get(Source, source_id)
    if source is None or source.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Source not found")

    if source.status != SourceStatus.READY:
        raise HTTPException(status_code=400, detail="Source is not ready")

    # Embed the question
    embeddings = await embedder.embed([payload.question])
    if not embeddings:
        return SourceQAResponse(
            source_id=source_id,
            answer="无法处理您的问题，请稍后重试。",
            created_at=datetime.datetime.now(datetime.UTC),
        )

    query_vector = embeddings[0]

    # Search only within this source's chunks
    results = await vector_store.search(
        notebook_id=notebook_id,
        query_vector=query_vector,
        top_k=5,
        min_score=0.1,
        source_ids=[source_id],  # Filter to this source only
    )

    if not results:
        # Fallback: get all chunks from this source
        chunk_result = await session.execute(
            select(Chunk)
            .where(Chunk.source_id == source_id)
            .order_by(Chunk.chunk_index.asc())
            .limit(5)
        )
        chunks = chunk_result.scalars().all()
        if not chunks:
            return SourceQAResponse(
                source_id=source_id,
                answer="文档中未找到相关信息。",
                created_at=datetime.datetime.now(datetime.UTC),
            )
        context = "\n\n".join(f"[片段 {i + 1}]\n{chunk.text}" for i, chunk in enumerate(chunks))
    else:
        # Get chunk texts from search results
        chunk_ids = [r.entry.chunk_id for r in results]
        chunk_result = await session.execute(
            select(Chunk).where(Chunk.id.in_(chunk_ids))
        )
        chunks = {c.id: c for c in chunk_result.scalars().all()}
        context = "\n\n".join(
            f"[片段]\n{chunks[r.entry.chunk_id].text}"
            for r in results
            if r.entry.chunk_id in chunks
        )

    # Generate answer using AI
    messages = [
        ChatMessage(role="system", content=SOURCE_QA_SYSTEM_PROMPT),
        ChatMessage(
            role="user",
            content=f"基于以下来自「{source.filename}」的内容回答问题。\n\n文档内容：\n{context}\n\n问题：{payload.question}",
        ),
    ]

    try:
        answer = await chatter.chat(messages)
    except Exception:
        answer = "生成回答时发生错误，请稍后重试。"

    return SourceQAResponse(
        source_id=source_id,
        answer=answer,
        created_at=datetime.datetime.now(datetime.UTC),
    )
