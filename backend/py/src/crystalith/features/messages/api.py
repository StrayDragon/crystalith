from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.deps import get_db_session

from . import service
from .schemas import MessageCreate, MessageRead


router = APIRouter(
    prefix="/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
    tags=["messages"],
)


async def _require_session(
    db: AsyncSession,
    *,
    notebook_id: int,
    session_id: int,
):
    notebook = await service.get_notebook(db, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    db_session = await service.get_session(db, session_id)
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
    await _require_session(session, notebook_id=notebook_id, session_id=session_id)
    message = await service.create_message(
        session,
        session_id=session_id,
        role=payload.role,
        content=payload.content,
        citations=[item.model_dump() for item in payload.citations] if payload.citations else None,
    )
    return MessageRead.model_validate(message)


@router.get("", response_model=list[MessageRead])
async def list_messages(
    notebook_id: int,
    session_id: int,
    session: AsyncSession = Depends(get_db_session),
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
) -> list[MessageRead]:
    await _require_session(session, notebook_id=notebook_id, session_id=session_id)
    messages = await service.list_messages(
        session,
        session_id=session_id,
        offset=offset,
        limit=limit,
    )
    return [MessageRead.model_validate(item) for item in messages]
