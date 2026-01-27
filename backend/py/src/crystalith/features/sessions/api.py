from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db.deps import get_db_session

from . import service
from .schemas import SessionCreate, SessionRead, SessionUpdate


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/sessions", tags=["sessions"])


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
