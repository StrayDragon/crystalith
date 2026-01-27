from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Notebook, Session

from . import repo


async def get_notebook(session: AsyncSession, notebook_id: int) -> Notebook | None:
    return await session.get(Notebook, notebook_id)


async def create_session(
    session: AsyncSession,
    *,
    notebook_id: int,
    title: str | None,
) -> Session:
    return await repo.create_session(session, notebook_id=notebook_id, title=title)


async def list_sessions(
    session: AsyncSession,
    *,
    notebook_id: int,
    offset: int,
    limit: int,
) -> list[Session]:
    return await repo.list_sessions(session, notebook_id=notebook_id, offset=offset, limit=limit)


async def get_session(session: AsyncSession, session_id: int) -> Session | None:
    return await repo.get_session(session, session_id)


async def update_session(
    session: AsyncSession,
    db_session: Session,
    *,
    title: str | None,
) -> Session:
    return await repo.update_session(session, db_session, title=title)


async def delete_session(session: AsyncSession, db_session: Session) -> None:
    await repo.delete_session(session, db_session)
