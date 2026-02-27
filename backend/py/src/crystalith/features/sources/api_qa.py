from __future__ import annotations

import datetime

from cl_logs import get_logger
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.shared.ai.types import ChatMessage
from crystalith.shared.cache import CacheProvider
from crystalith.shared.db import Chunk, Source
from crystalith.shared.deps import (
    get_ai_provider,
    get_cache_provider,
    get_db_session,
    get_embedding_provider,
    get_vector_store,
)
from crystalith.shared.types import SourceStatus
from crystalith.shared.vector_storage import VectorStore, cached_vector_search

from .api_common import _invalidate_notebook_source_caches
from crystalith.shared.source_diagnostics import (
    SOURCE_ERROR_EMBEDDING_FAILED,
    SOURCE_ERROR_INGESTION_FAILED,
    SOURCE_ERROR_VECTOR_STORE_FAILED,
    SourceFailure,
    apply_source_failure,
    raise_source_failure,
)
from .api_schemas import (
    ConvertSourceQAToSourceRequest,
    ConvertSourceQAToSourceResponse,
    QAMessage,
    SourceQARequest,
    SourceQAResponse,
)

logger = get_logger(__name__)

router = APIRouter()


SOURCE_QA_SYSTEM_PROMPT = """你是一个基于文档的问答助手。请仅根据提供的文档内容回答用户的问题。
如果文档中没有相关信息，请明确说明"文档中未找到相关信息"。
请用中文回复，回答要简洁准确。"""


@router.post("/{source_id}/qa", response_model=SourceQAResponse)
async def source_qa(
    notebook_id: int,
    source_id: int,
    payload: SourceQARequest,
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    chatter: ChatProvider = Depends(get_ai_provider),
    vector_store: VectorStore = Depends(get_vector_store),
    cache: CacheProvider = Depends(get_cache_provider),
) -> SourceQAResponse:
    """Answer a question based on a specific source's content."""
    source = await session.get(Source, source_id)
    if source is None or source.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Source not found")

    if source.status != SourceStatus.READY:
        raise HTTPException(status_code=400, detail="Source is not ready")

    # Embed the question
    embeddings = await embedder.embed_batch([payload.question])
    if not embeddings:
        return SourceQAResponse(
            source_id=source_id,
            answer="无法处理您的问题，请稍后重试。",
            created_at=datetime.datetime.now(datetime.UTC),
        )

    query_vector = embeddings[0]

    # Search only within this source's chunks
    results = await cached_vector_search(
        cache=cache,
        vector_store=vector_store,
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


def _split_text_to_chunks(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into chunks for embedding."""
    if not text:
        return []

    # Split by paragraphs first
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks: list[str] = []
    current_chunk: list[str] = []
    current_length = 0

    for para in paragraphs:
        para_len = len(para)

        if current_length + para_len <= chunk_size:
            current_chunk.append(para)
            current_length += para_len
        else:
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
            # Start new chunk with overlap
            if para_len > chunk_size:
                # Split long paragraph
                words = para.split()
                temp_chunk: list[str] = []
                temp_len = 0
                for word in words:
                    if temp_len + len(word) + 1 <= chunk_size:
                        temp_chunk.append(word)
                        temp_len += len(word) + 1
                    else:
                        if temp_chunk:
                            chunks.append(" ".join(temp_chunk))
                        temp_chunk = [word]
                        temp_len = len(word)
                if temp_chunk:
                    current_chunk = [" ".join(temp_chunk)]
                    current_length = temp_len
                else:
                    current_chunk = []
                    current_length = 0
            else:
                current_chunk = [para]
                current_length = para_len

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks


def _format_qa_messages_as_markdown(
    messages: list[QAMessage],
    source_title: str,
) -> str:
    """Format QA messages as markdown content."""
    timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d %H:%M:%S")
    content = "# 来源问答记录\n\n"
    content += f"**原始来源**: {source_title}\n"
    content += f"**生成时间**: {timestamp} UTC\n\n"
    content += "---\n\n"

    for msg in messages:
        role = "**问**" if msg.role == "user" else "**答**"
        content += f"{role}: {msg.content}\n\n"

    return content


@router.post(
    "/{source_id}/qa/convert-to-source",
    response_model=ConvertSourceQAToSourceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def convert_source_qa_to_source(
    notebook_id: int,
    source_id: int,
    payload: ConvertSourceQAToSourceRequest,
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    vector_store: VectorStore = Depends(get_vector_store),
    cache: CacheProvider = Depends(get_cache_provider),
) -> ConvertSourceQAToSourceResponse:
    """Convert source QA conversation to a new source document for RAG queries."""
    # Verify source exists
    original_source = await session.get(Source, source_id)
    if original_source is None or original_source.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Source not found")

    logger.info(
        "converting source QA to source",
        source_id=source_id,
        notebook_id=notebook_id,
        message_count=len(payload.messages),
    )

    # Format messages as markdown
    source_title = original_source.filename
    text_content = _format_qa_messages_as_markdown(payload.messages, source_title)

    if not text_content.strip():
        raise HTTPException(status_code=400, detail="No content to convert")

    # Generate filename
    timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d_%H%M%S")
    # Remove extension from original filename if present
    base_name = source_title.rsplit(".", 1)[0] if "." in source_title else source_title
    filename = f"问答_{base_name}_{timestamp}.md"

    # Build metadata
    metadata = {
        "converted_from_source_qa": source_id,
        "original_source_title": source_title,
        "conversion_timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "message_count": len(payload.messages),
        "word_count": len(text_content.split()),
    }

    # Create source
    source = Source(
        notebook_id=notebook_id,
        filename=filename,
        mime_type="text/markdown",
        parser_type="text",
        metadata_=metadata,
        status=SourceStatus.PROCESSING,
    )
    session.add(source)
    await session.commit()
    await session.refresh(source)

    try:
        stage = "chunks"
        # Split into chunks
        chunk_texts = _split_text_to_chunks(text_content)
        if not chunk_texts:
            chunk_texts = [text_content]

        # Create embeddings
        stage = "embed"
        embeddings = await embedder.embed_batch(chunk_texts)

        # Create chunks and store in vector store
        stage = "chunks"
        db_chunks: list[Chunk] = []
        for idx, (chunk_text, embedding) in enumerate(zip(chunk_texts, embeddings)):
            chunk = Chunk(
                source_id=source.id,
                chunk_index=idx,
                text=chunk_text,
                metadata_={"source_type": "converted_source_qa"},
            )
            session.add(chunk)
            await session.flush()
            db_chunks.append(chunk)

        # Add to vector store
        stage = "vector_store"
        await vector_store.add(
            notebook_id=notebook_id,
            source_id=source.id,
            chunk_ids=[c.id for c in db_chunks],
            vectors=embeddings,
        )

        # Mark source as ready
        stage = "commit_ready"
        source.status = SourceStatus.READY
        source.error_code = None
        source.error_message = None
        source.recovery_hint = None
        source.last_error_at = None
        await session.commit()

        logger.info(
            "source QA converted to source successfully",
            source_id=source.id,
            chunk_count=len(db_chunks),
        )

        await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id, vectors_changed=True)
        return ConvertSourceQAToSourceResponse(
            source_id=source.id,
            filename=filename,
        )

    except Exception as exc:
        logger.error(
            "failed to convert source QA to source",
            source_id=source.id,
            error=str(exc),
        )
        if stage != "vector_store":
            await session.rollback()
        if stage == "embed":
            failure = SourceFailure(
                error_code=SOURCE_ERROR_EMBEDDING_FAILED,
                message="来源问答转换失败：向量嵌入失败",
                recovery_hint="检查 embedding 模型/服务是否可用，或稍后重试。",
                status_code=503,
                details=str(exc)[:512],
            )
        elif stage == "vector_store":
            failure = SourceFailure(
                error_code=SOURCE_ERROR_VECTOR_STORE_FAILED,
                message="来源问答转换失败：写入向量库失败",
                recovery_hint="检查向量库服务配置与连通性，或稍后重试。",
                status_code=503,
                details=str(exc)[:512],
            )
        else:
            failure = SourceFailure(
                error_code=SOURCE_ERROR_INGESTION_FAILED,
                message="来源问答转换失败",
                recovery_hint="可稍后重试；若持续失败，检查日志或依赖服务状态。",
                status_code=500,
                details=str(exc)[:512],
            )
        apply_source_failure(source, failure)
        await session.commit()
        raise_source_failure(failure)
