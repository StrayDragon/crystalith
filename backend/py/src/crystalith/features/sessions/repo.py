from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Session


async def create_session(
    session: AsyncSession,
    *,
    notebook_id: int,
    title: str | None,
) -> Session:
    db_session = Session(notebook_id=notebook_id, title=title)
    session.add(db_session)
    await session.commit()
    await session.refresh(db_session)
    return db_session


async def list_sessions(
    session: AsyncSession,
    *,
    notebook_id: int,
    offset: int,
    limit: int,
) -> list[Session]:
    result = await session.execute(
        select(Session)
        .where(Session.notebook_id == notebook_id)
        .order_by(Session.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_session(session: AsyncSession, session_id: int) -> Session | None:
    return await session.get(Session, session_id)


async def update_session(
    session: AsyncSession,
    db_session: Session,
    *,
    title: str | None,
) -> Session:
    if title is not None:
        db_session.title = title
    await session.commit()
    await session.refresh(db_session)
    return db_session


async def delete_session(session: AsyncSession, db_session: Session) -> None:
    await session.delete(db_session)
    await session.commit()
