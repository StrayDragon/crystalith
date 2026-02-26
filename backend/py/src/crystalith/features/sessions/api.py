from __future__ import annotations

import datetime

from cl_logs import get_logger
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import EmbeddingProvider
from crystalith.shared.cache import CacheProvider
from crystalith.shared.cache.epochs import bump_sources_epoch
from crystalith.shared.db import Chunk, Message, Output, Source
from crystalith.shared.deps import get_cache_provider, get_db_session, get_embedding_provider, get_vector_store
from crystalith.shared.types import OutputType, SourceStatus
from crystalith.shared.vector_storage import VectorStore, bump_vector_epoch

from crystalith.shared.source_diagnostics import (
    SOURCE_ERROR_EMBEDDING_FAILED,
    SOURCE_ERROR_INGESTION_FAILED,
    SOURCE_ERROR_VECTOR_STORE_FAILED,
    SourceFailure,
    apply_source_failure,
    raise_source_failure,
)

from . import service
from .schemas import SessionCreate, SessionRead, SessionUpdate


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/sessions", tags=["sessions"])
log = get_logger(__name__)


class ConvertSessionToSourceRequest(BaseModel):
    """Request to convert session messages to a source document."""

    message_ids: list[int] | None = Field(
        None,
        description="Specific message IDs to convert. If null, converts entire session.",
    )


class ConvertSessionToSourceResponse(BaseModel):
    """Response after converting session to source."""

    source_id: int
    filename: str
    chunk_count: int


class ConvertSessionToOutputRequest(BaseModel):
    """Request to convert session messages to an output."""

    message_ids: list[int] | None = Field(
        None,
        description="Specific message IDs to convert. If null, converts entire session.",
    )
    output_type: OutputType = Field(
        OutputType.PARAGRAPH,
        description="Type of output to create.",
    )


class ConvertSessionToOutputResponse(BaseModel):
    """Response after converting session to output."""

    output_id: int
    output_type: str
    title: str


async def _require_notebook(session: AsyncSession, notebook_id: int) -> None:
    notebook = await service.get_notebook(session, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")


async def _require_session(
    session: AsyncSession,
    *,
    notebook_id: int,
    session_id: int,
):
    db_session = await service.get_session(session, session_id)
    if db_session is None or db_session.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Session not found")
    return db_session


async def _get_session_messages(
    session: AsyncSession,
    session_id: int,
    message_ids: list[int] | None = None,
) -> list[Message]:
    if message_ids:
        result = await session.execute(
            select(Message)
            .where(Message.session_id == session_id, Message.id.in_(message_ids))
            .order_by(Message.created_at.asc())
        )
    else:
        result = await session.execute(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.created_at.asc())
        )
    return list(result.scalars().all())


def _extract_messages_text(messages: list[Message], format: str = "markdown") -> str:
    if not messages:
        return ""

    parts: list[str] = []
    for msg in messages:
        if format == "raw":
            parts.append(msg.content)
        else:
            role_label = "用户" if msg.role == "user" else "助手"
            parts.append(f"**{role_label}**:\n{msg.content}")

    return "\n\n".join(parts)


def _split_text_to_chunks(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    if not text:
        return []

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

            if para_len > chunk_size:
                sentences = para.replace(". ", ".\n").replace("。", "。\n").split("\n")
                for sent in sentences:
                    if len(sent) <= chunk_size:
                        chunks.append(sent)
                    else:
                        for i in range(0, len(sent), chunk_size - overlap):
                            chunks.append(sent[i : i + chunk_size])
            else:
                current_chunk = [para]
                current_length = para_len

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks


@router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    notebook_id: int,
    payload: SessionCreate,
    session: AsyncSession = Depends(get_db_session),
) -> SessionRead:
    await _require_notebook(session, notebook_id)
    db_session = await service.create_session(
        session,
        notebook_id=notebook_id,
        title=payload.title,
    )
    return SessionRead.model_validate(db_session)


@router.get("", response_model=list[SessionRead])
async def list_sessions(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[SessionRead]:
    await _require_notebook(session, notebook_id)
    sessions = await service.list_sessions(
        session,
        notebook_id=notebook_id,
        offset=offset,
        limit=limit,
    )
    return [SessionRead.model_validate(item) for item in sessions]


@router.get("/{session_id}", response_model=SessionRead)
async def get_session(
    notebook_id: int,
    session_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> SessionRead:
    db_session = await _require_session(
        session, notebook_id=notebook_id, session_id=session_id
    )
    return SessionRead.model_validate(db_session)


@router.patch("/{session_id}", response_model=SessionRead)
async def update_session(
    notebook_id: int,
    session_id: int,
    payload: SessionUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> SessionRead:
    db_session = await _require_session(
        session, notebook_id=notebook_id, session_id=session_id
    )
    db_session = await service.update_session(session, db_session, title=payload.title)
    return SessionRead.model_validate(db_session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    notebook_id: int,
    session_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    db_session = await _require_session(
        session, notebook_id=notebook_id, session_id=session_id
    )
    await service.delete_session(session, db_session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{session_id}/convert-to-source",
    response_model=ConvertSessionToSourceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def convert_session_to_source(
    notebook_id: int,
    session_id: int,
    payload: ConvertSessionToSourceRequest,
    session: AsyncSession = Depends(get_db_session),
    cache: CacheProvider = Depends(get_cache_provider),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    vector_store: VectorStore = Depends(get_vector_store),
) -> ConvertSessionToSourceResponse:
    db_session = await _require_session(
        session, notebook_id=notebook_id, session_id=session_id
    )

    messages = await _get_session_messages(session, session_id, payload.message_ids)
    if not messages:
        raise HTTPException(status_code=400, detail="No messages found to convert")

    if payload.message_ids:
        found_ids = {msg.id for msg in messages}
        missing_ids = set(payload.message_ids) - found_ids
        if missing_ids:
            raise HTTPException(
                status_code=404,
                detail=f"Messages not found: {list(missing_ids)}",
            )

    log.info(
        "converting session to source",
        notebook_id=notebook_id,
        session_id=session_id,
        message_count=len(messages),
    )

    text_content = _extract_messages_text(messages, format="markdown")
    if not text_content:
        raise HTTPException(status_code=400, detail="Messages have no content to convert")

    session_title = db_session.title or f"会话_{session_id}"
    timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d_%H%M%S")
    filename = f"对话_{session_title}_{timestamp}.md"

    metadata = {
        "converted_from_session": session_id,
        "conversion_timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "message_count": len(messages),
        "word_count": len(text_content.split()),
    }
    if payload.message_ids:
        metadata["converted_from_messages"] = payload.message_ids

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
        chunk_texts = _split_text_to_chunks(text_content)
        if not chunk_texts:
            chunk_texts = [text_content]

        stage = "embed"
        embeddings = await embedder.embed_batch(chunk_texts)

        stage = "chunks"
        db_chunks: list[Chunk] = []
        for idx, chunk_text in enumerate(chunk_texts):
            chunk = Chunk(
                source_id=source.id,
                chunk_index=idx,
                text=chunk_text,
                metadata_={"source_type": "converted_session"},
            )
            session.add(chunk)
            db_chunks.append(chunk)

        await session.flush()
        chunk_ids = [chunk.id for chunk in db_chunks]

        source.status = SourceStatus.READY
        source.error_code = None
        source.error_message = None
        source.recovery_hint = None
        source.last_error_at = None
        await session.commit()

        stage = "vector_store"
        await vector_store.add(
            notebook_id=notebook_id,
            source_id=source.id,
            chunk_ids=chunk_ids,
            vectors=embeddings,
        )

        log.info(
            "session converted to source",
            session_id=session_id,
            source_id=source.id,
            chunk_count=len(db_chunks),
        )

        await bump_sources_epoch(cache=cache, notebook_id=notebook_id)
        await bump_vector_epoch(cache=cache, notebook_id=notebook_id)

        return ConvertSessionToSourceResponse(
            source_id=source.id,
            filename=filename,
            chunk_count=len(db_chunks),
        )

    except Exception as exc:
        log.error("failed to convert session to source", exc_info=exc)
        await session.rollback()
        if stage == "embed":
            failure = SourceFailure(
                error_code=SOURCE_ERROR_EMBEDDING_FAILED,
                message="转换会话失败：向量嵌入失败",
                recovery_hint="检查 embedding 模型/服务是否可用，或稍后重试。",
                status_code=503,
                details=str(exc)[:512],
            )
        elif stage == "vector_store":
            failure = SourceFailure(
                error_code=SOURCE_ERROR_VECTOR_STORE_FAILED,
                message="转换会话失败：写入向量库失败",
                recovery_hint="检查向量库服务配置与连通性，或稍后重试。",
                status_code=503,
                details=str(exc)[:512],
            )
        else:
            failure = SourceFailure(
                error_code=SOURCE_ERROR_INGESTION_FAILED,
                message="转换会话失败",
                recovery_hint="可稍后重试；若持续失败，检查日志或依赖服务状态。",
                status_code=500,
                details=str(exc)[:512],
            )
        apply_source_failure(source, failure)
        session.add(source)
        await session.commit()
        raise_source_failure(failure)


@router.post(
    "/{session_id}/convert-to-output",
    response_model=ConvertSessionToOutputResponse,
    status_code=status.HTTP_201_CREATED,
)
async def convert_session_to_output(
    notebook_id: int,
    session_id: int,
    payload: ConvertSessionToOutputRequest,
    session: AsyncSession = Depends(get_db_session),
) -> ConvertSessionToOutputResponse:
    if payload.output_type not in {
        OutputType.PARAGRAPH,
        OutputType.BULLETS,
        OutputType.STRUCTURED,
    }:
        raise HTTPException(status_code=400, detail="Unsupported output type for session conversion")

    db_session = await _require_session(
        session, notebook_id=notebook_id, session_id=session_id
    )

    messages = await _get_session_messages(session, session_id, payload.message_ids)
    if not messages:
        raise HTTPException(status_code=400, detail="No messages found to convert")

    if payload.message_ids:
        found_ids = {msg.id for msg in messages}
        missing_ids = set(payload.message_ids) - found_ids
        if missing_ids:
            raise HTTPException(
                status_code=404,
                detail=f"Messages not found: {list(missing_ids)}",
            )

    log.info(
        "converting session to output",
        notebook_id=notebook_id,
        session_id=session_id,
        message_count=len(messages),
        output_type=payload.output_type.value,
    )

    text_content = _extract_messages_text(messages, format="raw")
    if not text_content:
        raise HTTPException(status_code=400, detail="Messages have no content to convert")

    session_title = db_session.title or f"会话 {session_id}"
    output_type_labels = {
        OutputType.PARAGRAPH: "段落笔记",
        OutputType.BULLETS: "要点笔记",
        OutputType.STRUCTURED: "结构化笔记",
    }
    type_label = output_type_labels.get(payload.output_type, "笔记")
    title = f"{session_title} - {type_label}"

    if payload.output_type == OutputType.BULLETS:
        lines = [line.strip() for line in text_content.split("\n") if line.strip()]
        content = {
            "title": title,
            "bullets": lines[:50],
            "_metadata": {
                "converted_from_session": session_id,
                "message_count": len(messages),
            },
        }
        if payload.message_ids:
            content["_metadata"]["converted_from_messages"] = payload.message_ids
    elif payload.output_type == OutputType.STRUCTURED:
        content = {
            "title": title,
            "sections": [
                {
                    "title": "对话内容",
                    "content": text_content,
                }
            ],
            "_metadata": {
                "converted_from_session": session_id,
                "message_count": len(messages),
            },
        }
        if payload.message_ids:
            content["_metadata"]["converted_from_messages"] = payload.message_ids
    else:
        content = {
            "title": title,
            "text": text_content,
            "_metadata": {
                "converted_from_session": session_id,
                "message_count": len(messages),
            },
        }
        if payload.message_ids:
            content["_metadata"]["converted_from_messages"] = payload.message_ids

    chunk_ids: list[int] = []
    for msg in messages:
        if not msg.citations:
            continue
        citations = msg.citations if isinstance(msg.citations, list) else [msg.citations]
        for citation in citations:
            if isinstance(citation, dict) and "chunk_id" in citation:
                cid = citation["chunk_id"]
                if isinstance(cid, int) and cid not in chunk_ids:
                    chunk_ids.append(cid)

    output = Output(
        notebook_id=notebook_id,
        type=payload.output_type,
        prompt=f"从会话 {session_id} 转换",
        chunk_ids=chunk_ids or None,
        content=content,
    )
    session.add(output)
    await session.commit()
    await session.refresh(output)

    log.info(
        "session converted to output",
        session_id=session_id,
        output_id=output.id,
        output_type=payload.output_type.value,
    )

    return ConvertSessionToOutputResponse(
        output_id=output.id,
        output_type=payload.output_type.value,
        title=title,
    )
