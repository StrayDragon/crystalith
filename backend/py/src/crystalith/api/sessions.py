from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.db import Notebook, Session
from crystalith.schemas.sessions import SessionCreate, SessionRead, SessionUpdate

from .deps import get_db_session


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
