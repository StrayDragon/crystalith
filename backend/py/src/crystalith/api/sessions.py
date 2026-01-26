from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cl_logs.logging import get_logger

from crystalith.ai.interfaces import EmbeddingProvider
from crystalith.db import Chunk, Message, Notebook, Output, Session, Source, SourceStatus
from crystalith.outputs import OutputType
from crystalith.schemas.sessions import SessionCreate, SessionRead, SessionUpdate
from crystalith.vector_storage import VectorStore

from .deps import get_db_session, get_embedding_provider, get_vector_store


log = get_logger(__name__)


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/sessions", tags=["sessions"])


async def _get_notebook(session: AsyncSession, notebook_id: int) -> Notebook:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return notebook


async def _get_session(
    session: AsyncSession,
    notebook_id: int,
    session_id: int,
) -> Session:
    db_session = await session.get(Session, session_id)
    if db_session is None or db_session.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Session not found")
    return db_session


@router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    notebook_id: int,
    payload: SessionCreate,
    session: AsyncSession = Depends(get_db_session),
) -> SessionRead:
    await _get_notebook(session, notebook_id)
    db_session = Session(notebook_id=notebook_id, title=payload.title)
    session.add(db_session)
    await session.commit()
    await session.refresh(db_session)
    return SessionRead.model_validate(db_session)


@router.get("", response_model=list[SessionRead])
async def list_sessions(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[SessionRead]:
    await _get_notebook(session, notebook_id)
    result = await session.execute(
        select(Session)
        .where(Session.notebook_id == notebook_id)
        .order_by(Session.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [SessionRead.model_validate(item) for item in result.scalars().all()]


@router.get("/{session_id}", response_model=SessionRead)
async def get_session(
    notebook_id: int,
    session_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> SessionRead:
    db_session = await _get_session(session, notebook_id, session_id)
    return SessionRead.model_validate(db_session)


@router.patch("/{session_id}", response_model=SessionRead)
async def update_session(
    notebook_id: int,
    session_id: int,
    payload: SessionUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> SessionRead:
    db_session = await _get_session(session, notebook_id, session_id)
    if payload.title is not None:
        db_session.title = payload.title
    await session.commit()
    await session.refresh(db_session)
    return SessionRead.model_validate(db_session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    notebook_id: int,
    session_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    db_session = await _get_session(session, notebook_id, session_id)
    await session.delete(db_session)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Session Conversion Endpoints ---


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


def _extract_messages_text(messages: list[Message], format: str = "markdown") -> str:
    """Extract text content from messages for conversion.

    Args:
        messages: List of Message objects.
        format: Output format - 'raw' for plain text, 'markdown' for formatted.

    Returns:
        Combined text content from messages.
    """
    if not messages:
        return ""

    parts: list[str] = []
    for msg in messages:
        if format == "raw":
            parts.append(msg.content)
        elif format == "markdown":
            role_label = "用户" if msg.role == "user" else "助手"
            parts.append(f"**{role_label}**:\n{msg.content}")

    return "\n\n".join(parts)


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

            # If paragraph is too long, split by sentences
            if para_len > chunk_size:
                sentences = para.replace(". ", ".\n").replace("。", "。\n").split("\n")
                for sent in sentences:
                    if len(sent) <= chunk_size:
                        chunks.append(sent)
                    else:
                        # Last resort: split by character
                        for i in range(0, len(sent), chunk_size - overlap):
                            chunks.append(sent[i : i + chunk_size])
            else:
                current_chunk = [para]
                current_length = para_len

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks


async def _get_session_messages(
    db: AsyncSession,
    session_id: int,
    message_ids: list[int] | None = None,
) -> list[Message]:
    """Get messages from a session, optionally filtered by IDs."""
    if message_ids:
        result = await db.execute(
            select(Message)
            .where(Message.session_id == session_id, Message.id.in_(message_ids))
            .order_by(Message.created_at.asc())
        )
    else:
        result = await db.execute(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.created_at.asc())
        )
    return list(result.scalars().all())


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
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    vector_store: VectorStore = Depends(get_vector_store),
) -> ConvertSessionToSourceResponse:
    """Convert session messages to a source document for RAG queries."""
    db_session = await _get_session(session, notebook_id, session_id)

    # Get messages
    messages = await _get_session_messages(session, session_id, payload.message_ids)

    if not messages:
        raise HTTPException(status_code=400, detail="No messages found to convert")

    # Validate message_ids if provided
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

    # Extract text content
    text_content = _extract_messages_text(messages, format="markdown")
    if not text_content:
        raise HTTPException(status_code=400, detail="Messages have no content to convert")

    # Generate filename
    session_title = db_session.title or f"会话_{session_id}"
    timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d_%H%M%S")
    filename = f"对话_{session_title}_{timestamp}.md"

    # Build metadata
    metadata = {
        "converted_from_session": session_id,
        "conversion_timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "message_count": len(messages),
        "word_count": len(text_content.split()),
    }
    if payload.message_ids:
        metadata["converted_from_messages"] = payload.message_ids

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
        # Split into chunks
        chunk_texts = _split_text_to_chunks(text_content)
        if not chunk_texts:
            chunk_texts = [text_content]

        # Create embeddings
        embeddings = await embedder.embed(chunk_texts)

        # Create chunks in database
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

        # Update source status
        source.status = SourceStatus.READY
        await session.commit()

        # Add to vector store (batch add)
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

        return ConvertSessionToSourceResponse(
            source_id=source.id,
            filename=filename,
            chunk_count=len(db_chunks),
        )

    except Exception as exc:
        log.error("failed to convert session to source", exc_info=exc)
        source.status = SourceStatus.FAILED
        source.error_message = str(exc)[:500]
        await session.commit()
        raise HTTPException(
            status_code=500,
            detail="Failed to convert session to source. Please try again.",
        ) from exc


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
    """Convert session messages to a studio output/note."""
    if payload.output_type not in {
        OutputType.PARAGRAPH,
        OutputType.BULLETS,
        OutputType.STRUCTURED,
    }:
        raise HTTPException(status_code=400, detail="Unsupported output type for session conversion")
    db_session = await _get_session(session, notebook_id, session_id)

    # Get messages
    messages = await _get_session_messages(session, session_id, payload.message_ids)

    if not messages:
        raise HTTPException(status_code=400, detail="No messages found to convert")

    # Validate message_ids if provided
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

    # Extract text content
    text_content = _extract_messages_text(messages, format="raw")
    if not text_content:
        raise HTTPException(status_code=400, detail="Messages have no content to convert")

    # Generate title
    session_title = db_session.title or f"会话 {session_id}"

    # Build content based on output type
    output_type_labels = {
        OutputType.PARAGRAPH: "段落笔记",
        OutputType.BULLETS: "要点笔记",
        OutputType.STRUCTURED: "结构化笔记",
    }
    type_label = output_type_labels.get(payload.output_type, "笔记")
    title = f"{session_title} - {type_label}"

    # Build content structure based on output type
    if payload.output_type == OutputType.BULLETS:
        # Split into bullet points
        lines = [line.strip() for line in text_content.split("\n") if line.strip()]
        content = {
            "title": title,
            "bullets": lines[:50],  # Limit to 50 bullets
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
        # Default: PARAGRAPH
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

    # Collect chunk_ids from citations if present
    chunk_ids: list[int] = []
    for msg in messages:
        if msg.citations and isinstance(msg.citations, list):
            for citation in msg.citations:
                if isinstance(citation, dict) and "chunk_id" in citation:
                    cid = citation["chunk_id"]
                    if isinstance(cid, int) and cid not in chunk_ids:
                        chunk_ids.append(cid)

    # Create output
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
