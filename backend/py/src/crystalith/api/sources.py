from __future__ import annotations

import datetime
from time import perf_counter
from typing import Any, Iterable

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from cl_stdx.enumx import MetaInfoStrEnum, XMetaInfo

from crystalith.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.ai.types import ChatMessage
from crystalith.agents.deps import StudioDeps
from crystalith.agents.search_graph import run_search_graph
from crystalith.config import Settings
from crystalith.db import Chunk, Notebook, Source, SourceStatus
from crystalith.parsers import Parser, ParserFactory, TranscriptionProvider, UnsupportedDocumentError
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
