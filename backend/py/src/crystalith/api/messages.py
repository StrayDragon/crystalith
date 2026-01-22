from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.db import Message, Notebook, Session
from crystalith.schemas.messages import MessageCreate, MessageRead

from .deps import get_db_session


router = APIRouter(
    prefix="/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
    tags=["messages"],
)


async def _get_session(
    db: AsyncSession, notebook_id: int, session_id: int
) -> Session:
    """Get session and verify it belongs to the notebook."""
    notebook = await db.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    db_session = await db.get(Session, session_id)
    if db_session is None or db_session.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Session not found")
    return db_session


@router.post("", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
async def create_message(
    notebook_id: int,
    session_id: int,
    payload: MessageCreate,
    session: AsyncSession = Depends(get_db_session),
) -> MessageRead:
    db_session = await _get_session(session, notebook_id, session_id)
    message = Message(
        session_id=session_id,
        role=payload.role,
        content=payload.content,
        citations=[item.model_dump() for item in payload.citations] if payload.citations else None,
    )
    db_session.updated_at = datetime.datetime.now(datetime.UTC)
    session.add(message)
    await session.commit()
    await session.refresh(message)
    return MessageRead.model_validate(message)


@router.get("", response_model=list[MessageRead])
async def list_messages(
    notebook_id: int,
    session_id: int,
    session: AsyncSession = Depends(get_db_session),
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
) -> list[MessageRead]:
    await _get_session(session, notebook_id, session_id)
    result = await session.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    return [MessageRead.model_validate(item) for item in result.scalars().all()]
