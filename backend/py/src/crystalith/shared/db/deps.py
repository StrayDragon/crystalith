from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from cl_sqlalchemyx.mgrs import AsyncDBManager


async def get_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    manager: AsyncDBManager = request.app.state.db
    async with manager.got_manual_session() as session:
        yield session
