from __future__ import annotations

from pathlib import Path
from typing import Protocol

import sqlalchemy as sa
from cl_sqlalchemyx.mgrs import AsyncDBManager
from sqlalchemy import event


class _DBAPICursor(Protocol):
    def execute(self, __sql: str) -> object: ...

    def close(self) -> None: ...


class _DBAPIConnection(Protocol):
    def cursor(self) -> _DBAPICursor: ...


def create_db_manager(
    database_url: str,
    *,
    readonly_sql: str | None = "SET TRANSACTION READ ONLY",
    **engine_kwargs: object,
) -> AsyncDBManager:
    url = sa.engine.make_url(database_url)
    if url.drivername.startswith("sqlite") and url.database and url.database != ":memory:":
        db_path = Path(url.database)
        if not db_path.is_absolute():
            db_path = Path.cwd() / db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        connect_args_value = engine_kwargs.get("connect_args")
        connect_args: dict[str, object] = {}
        if isinstance(connect_args_value, dict):
            connect_args = dict(connect_args_value)
        connect_args.setdefault("timeout", 30)
        engine_kwargs["connect_args"] = connect_args

    manager = AsyncDBManager(database_url, readonly_sql=readonly_sql, **engine_kwargs)

    if manager.dialect_name == "sqlite":

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
