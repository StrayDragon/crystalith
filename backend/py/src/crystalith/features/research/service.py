from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Notebook, ResearchSession

from . import repo


async def get_notebook(session: AsyncSession, notebook_id: int) -> Notebook | None:
    return await session.get(Notebook, notebook_id)


async def create_session(
    session: AsyncSession,
    *,
    notebook_id: int,
    topic: str,
) -> ResearchSession:
    return await repo.create_session(session, notebook_id=notebook_id, topic=topic)


async def list_sessions(session: AsyncSession, *, notebook_id: int) -> list[ResearchSession]:
    return await repo.list_sessions(session, notebook_id=notebook_id)


async def get_session(session: AsyncSession, research_id: int) -> ResearchSession | None:
    return await repo.get_session(session, research_id)


async def delete_session(session: AsyncSession, research: ResearchSession) -> None:
    await repo.delete_session(session, research)
