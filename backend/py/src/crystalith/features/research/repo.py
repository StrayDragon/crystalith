from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import ResearchSession
from crystalith.shared.types import ResearchStatus


async def create_session(
    session: AsyncSession,
    *,
    notebook_id: int,
    topic: str,
) -> ResearchSession:
    research = ResearchSession(
        notebook_id=notebook_id,
        topic=topic,
        status=ResearchStatus.PLANNING,
    )
    session.add(research)
    await session.commit()
    await session.refresh(research)
    return research


async def list_sessions(session: AsyncSession, *, notebook_id: int) -> list[ResearchSession]:
    result = await session.execute(
        select(ResearchSession)
        .where(ResearchSession.notebook_id == notebook_id)
        .order_by(ResearchSession.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_session(session: AsyncSession, research_id: int) -> ResearchSession | None:
    return await session.get(ResearchSession, research_id)


async def delete_session(session: AsyncSession, research: ResearchSession) -> None:
    await session.delete(research)
    await session.commit()
