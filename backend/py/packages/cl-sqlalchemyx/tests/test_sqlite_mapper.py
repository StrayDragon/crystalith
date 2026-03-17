from __future__ import annotations

from collections.abc import AsyncGenerator
from enum import Enum

import pytest
import pytest_asyncio
from cl_sqlalchemyx.mgrs import AsyncSQLiteManager, AsyncSQLiteManagersMapper
from sqlalchemy.pool import NullPool


class DBKey(Enum):
    MAIN = "main"
    ADB = "adb"


@pytest.fixture(scope="module")
def sqlite_dsn() -> str:
    return "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def mapper(sqlite_dsn: str) -> AsyncGenerator[AsyncSQLiteManagersMapper[DBKey], None]:
    mapper = AsyncSQLiteManagersMapper[DBKey](
        default_name=DBKey.MAIN,
        binds={
            DBKey.MAIN: sqlite_dsn,
            DBKey.ADB: sqlite_dsn,
        },
        engine_options_default={"poolclass": NullPool},
    )
    try:
        yield mapper
    finally:
        await mapper.close()


@pytest.mark.asyncio
async def test_get_manager(mapper: AsyncSQLiteManagersMapper[DBKey]) -> None:
    main_mgr = mapper.get_manager()
    assert isinstance(main_mgr, AsyncSQLiteManager)
    adb_mgr = mapper.get_manager(DBKey.ADB)
    assert isinstance(adb_mgr, AsyncSQLiteManager)


@pytest.mark.asyncio
async def test_health_check(mapper: AsyncSQLiteManagersMapper[DBKey]) -> None:
    statuses = await mapper.health_check()
    assert statuses[DBKey.MAIN] is True
    assert statuses[DBKey.ADB] is True
