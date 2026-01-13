from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from cl_sqlalchemyx.mgrs import AsyncDBManager


def create_db_manager(database_url: str, **engine_kwargs: Any) -> AsyncDBManager:
    manager = AsyncDBManager(database_url, **engine_kwargs)

    if manager.dialect_name == "sqlite":

        @sa.event.listens_for(manager.async_engine.sync_engine, "connect")
        def _set_sqlite_pragma(dbapi_connection: Any, _connection_record: Any) -> None:
            cursor = dbapi_connection.cursor()
            try:
                cursor.execute("PRAGMA foreign_keys=ON")
            finally:
                cursor.close()

    return manager
