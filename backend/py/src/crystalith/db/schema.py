from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncEngine

from cl_sqlalchemyx.base.dal import AsyncSqlATableBase

from . import models as _models  # noqa: F401
from ..tasks import models as _task_models  # noqa: F401


async def create_all(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(AsyncSqlATableBase.metadata.create_all)
