from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Message
from crystalith.shared.json_types import JsonDict


async def create_message(
    session: AsyncSession,
    *,
    session_id: int,
    role: str,
    content: str,
    citations: list[JsonDict] | None,
) -> Message:
    message = Message(
        session_id=session_id,
        role=role,
        content=content,
        citations=citations,
    )
    session.add(message)
    await session.commit()
    await session.refresh(message)
    return message


async def list_messages(
    session: AsyncSession,
    *,
    session_id: int,
    offset: int,
    limit: int,
) -> list[Message]:
    result = await session.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())
