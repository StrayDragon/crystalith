from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from cl_sqlalchemyx.base.dal import AsyncSqlATableBase

from . import models as _models  # noqa: F401
from ..tasks import models as _task_models  # noqa: F401


async def _sqlite_column_names(conn: AsyncConnection, table: str) -> set[str]:
    result = await conn.exec_driver_sql(f"PRAGMA table_info('{table}')")
    return {row[1] for row in result.fetchall()}


async def _ensure_sqlite_schema(conn: AsyncConnection) -> None:
    columns = await _sqlite_column_names(conn, "sources")
    if "parser_type" not in columns:
        await conn.exec_driver_sql(
            "ALTER TABLE sources ADD COLUMN parser_type VARCHAR(64) NOT NULL DEFAULT 'text'"
        )


async def create_all(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(AsyncSqlATableBase.metadata.create_all)
        if engine.dialect.name == "sqlite":
            await _ensure_sqlite_schema(conn)
