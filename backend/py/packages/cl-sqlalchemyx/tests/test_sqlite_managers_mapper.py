from __future__ import annotations

from enum import Enum

import pytest
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.pool import NullPool

from cl_sqlalchemyx.mgrs import AsyncSQLiteManager, AsyncSQLiteManagersMapper


class DBBind(Enum):
    DEFAULT = "default"
    REPORTING = "reporting"


@pytest.fixture(scope="module")
def sqlite_dsn() -> str:
    return "sqlite+aiosqlite:///:memory:"


@pytest.mark.asyncio
async def test_managers_mapper_with_enum(sqlite_dsn: str) -> None:
    binds = {
        DBBind.DEFAULT: sqlite_dsn,
        DBBind.REPORTING: sqlite_dsn,
    }
    binds_opts = {
        DBBind.REPORTING: {"echo": True, "poolclass": NullPool},
    }

    mapper = AsyncSQLiteManagersMapper[DBBind](
        default_name=DBBind.DEFAULT,
        binds=binds,
        engine_options_default={"echo": True, "poolclass": NullPool},
        binds_engine_options=binds_opts,
    )

    try:
        default_mgr = mapper.get_manager(DBBind.DEFAULT)
        assert isinstance(default_mgr, AsyncSQLiteManager)

        async with default_mgr.got_readonly_session() as session:
            assert isinstance(session, AsyncSession)
            rows = (await session.execute(sa.text("SELECT 1"))).all()
            assert rows[0][0] == 1

        reporting_mgr = mapper.get_manager(DBBind.REPORTING)
        async with reporting_mgr.got_readonly_session() as session:
            rows = (await session.execute(sa.text("SELECT 2"))).all()
            assert rows[0][0] == 2

        health = await mapper.health_check()
        assert set(health) == {DBBind.DEFAULT, DBBind.REPORTING}
    finally:
        await mapper.close()


def test_managers_mapper_requires_manager() -> None:
    with pytest.raises(ValueError, match="requires at least one manager"):
        AsyncSQLiteManagersMapper[DBBind](default_name=DBBind.DEFAULT, managers={})


async def test_managers_mapper_missing_default_name(sqlite_dsn: str) -> None:
    manager = AsyncSQLiteManager(sqlite_dsn, poolclass=NullPool)
    try:
        with pytest.raises(KeyError, match="Default enum not found"):
            AsyncSQLiteManagersMapper[DBBind](default_name=DBBind.DEFAULT, managers={DBBind.REPORTING: manager})
    finally:
        await manager.close()


async def test_managers_mapper_health_check_failure(monkeypatch: pytest.MonkeyPatch, sqlite_dsn: str) -> None:
    manager = AsyncSQLiteManager(sqlite_dsn, poolclass=NullPool)
    mapper = AsyncSQLiteManagersMapper[DBBind](default_name=DBBind.DEFAULT, managers={DBBind.DEFAULT: manager})

    async def bad_health_check() -> bool:
        raise RuntimeError("health check failed")

    # Mock reason: force manager failure path to validate aggregate health-check handling.
    monkeypatch.setattr(manager, "health_check", bad_health_check, raising=False)
    try:
        results = await mapper.health_check()
        assert results[DBBind.DEFAULT] is False
    finally:
        await mapper.close()
