from __future__ import annotations

import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Message, Notebook, Session
from crystalith.shared.json_types import JsonDict

from . import repo


async def get_notebook(session: AsyncSession, notebook_id: int) -> Notebook | None:
    return await session.get(Notebook, notebook_id)


async def get_session(session: AsyncSession, session_id: int) -> Session | None:
    return await session.get(Session, session_id)


async def create_message(
    session: AsyncSession,
    *,
    session_id: int,
    role: str,
    content: str,
    citations: list[JsonDict] | None,
) -> Message:
    db_session = await get_session(session, session_id)
    if db_session is not None:
        db_session.updated_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
    return await repo.create_message(
        session,
        session_id=session_id,
        role=role,
        content=content,
        citations=citations,
    )


async def list_messages(
    session: AsyncSession,
    *,
    session_id: int,
    offset: int,
    limit: int,
) -> list[Message]:
    return await repo.list_messages(session, session_id=session_id, offset=offset, limit=limit)
