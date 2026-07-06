from __future__ import annotations

from pathlib import Path
from typing import Protocol

import sqlalchemy as sa
from lush_sqlalchemyx.mgrs import AsyncMySQLManager
from sqlalchemy import event
from sqlalchemy.pool import NullPool


class _DBAPICursor(Protocol):
    def execute(self, __sql: str) -> object: ...

    def close(self) -> None: ...


class _DBAPIConnection(Protocol):
    def cursor(self) -> _DBAPICursor: ...


def create_db_manager(
    database_url: str,
) -> AsyncMySQLManager:
    url = sa.engine.make_url(database_url)
    is_sqlite = url.drivername.startswith("sqlite")

    if is_sqlite:
        if url.database and url.database != ":memory:":
            db_path = Path(url.database)
            if not db_path.is_absolute():
                db_path = Path.cwd() / db_path
            db_path.parent.mkdir(parents=True, exist_ok=True)

        manager = AsyncMySQLManager(
            database_url,
            connect_args={"timeout": 30},
            poolclass=NullPool,
        )
    else:
        manager = AsyncMySQLManager(database_url)

    if is_sqlite:

        @event.listens_for(manager.async_engine.sync_engine, "connect")
        def _set_sqlite_pragma(dbapi_connection: _DBAPIConnection, _connection_record: object) -> None:
            cursor = dbapi_connection.cursor()
            try:
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.execute("PRAGMA synchronous=NORMAL")
                cursor.execute("PRAGMA busy_timeout=5000")
            finally:
                cursor.close()

    return manager
