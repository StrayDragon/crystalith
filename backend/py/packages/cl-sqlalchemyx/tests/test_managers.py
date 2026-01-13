import pytest
import sqlalchemy as sa

from cl_sqlalchemyx.mgrs import AsyncPostgresManager, AsyncSQLiteManager


async def _assert_manager_works(manager) -> None:
    async with manager.got_manual_session() as session:
        result = await session.execute(sa.text("SELECT 1"))
        assert result.scalar() == 1

    async with manager.got_soft_impl_auto_commit_session() as session:
        result = await session.execute(sa.text("SELECT 1"))
        assert result.scalar() == 1

    async with manager.got_readonly_session() as session:
        result = await session.execute(sa.text("SELECT 1"))
        assert result.scalar() == 1

    await manager.close()


@pytest.mark.asyncio
async def test_sqlite_manager(tmp_path):
    db_path = tmp_path / "test.db"
    manager = AsyncSQLiteManager(f"sqlite+aiosqlite:///{db_path}")
    await _assert_manager_works(manager)


@pytest.mark.asyncio
async def test_postgres_manager(postgres_dsn: str):
    manager = AsyncPostgresManager(postgres_dsn)
    if not await manager.health_check():
        await manager.close()
        pytest.skip("Postgres not reachable")
    await _assert_manager_works(manager)
