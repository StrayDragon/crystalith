from __future__ import annotations

import types
from collections.abc import AsyncGenerator
from typing import Any

import pytest
import pytest_asyncio
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from cl_sqlalchemyx.mgrs import (
    AsyncSQLiteManager,
    aexecute_sql,
    async_configured_session_temporarily,
    async_must_rollback_if_in_transaction,
)
from cl_sqlalchemyx.same_impl_just_warn_wrapper import AsyncSession as WarnWrappedAsyncSession


@pytest.fixture(scope="module")
def sqlite_dsn() -> str:
    return "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_manager(sqlite_dsn: str) -> AsyncGenerator[AsyncSQLiteManager, None]:
    manager = AsyncSQLiteManager(sqlite_dsn, poolclass=NullPool)
    try:
        yield manager
    finally:
        await manager.close()


@pytest.mark.asyncio
async def test_get_session_success(db_manager: AsyncSQLiteManager) -> None:
    async with db_manager.got_manual_session() as session:
        assert isinstance(session, AsyncSession)
        result = await session.execute(text("SELECT 1"))
        row = result.fetchone()
        assert row is not None
        assert row[0] == 1


@pytest.mark.asyncio
async def test_get_session_exception_triggers_rollback_and_close(db_manager: AsyncSQLiteManager) -> None:
    with pytest.raises(RuntimeError):
        async with db_manager.got_manual_session():
            raise RuntimeError("boom")


@pytest.mark.asyncio
async def test_auto_commit_session(db_manager: AsyncSQLiteManager) -> None:
    async with db_manager.got_soft_impl_auto_commit_session() as session:
        result = await session.execute(text("SELECT 1"))
        assert result.fetchone() is not None


@pytest.mark.asyncio
async def test_readonly_session_exception_triggers_rollback_and_close(db_manager: AsyncSQLiteManager) -> None:
    with pytest.raises(RuntimeError):
        async with db_manager.got_readonly_session():
            raise RuntimeError("boom")


@pytest.mark.asyncio
async def test_warn_wrapped_session_begin(db_manager: AsyncSQLiteManager) -> None:
    session_factory = async_sessionmaker(
        bind=db_manager.async_engine,
        class_=WarnWrappedAsyncSession,
        autoflush=False,
        expire_on_commit=False,
        autocommit=False,
    )
    async with session_factory() as session:
        with pytest.deprecated_call():
            async with session.begin():  # pyright: ignore[reportDeprecated]
                row = (await session.execute(text("SELECT 1"))).fetchone()
                assert row is not None
                assert row[0] == 1


@pytest.mark.asyncio
async def test_health_check_true(db_manager: AsyncSQLiteManager) -> None:
    assert await db_manager.health_check() is True


@pytest.mark.asyncio
async def test_health_check_false(monkeypatch: pytest.MonkeyPatch, db_manager: AsyncSQLiteManager) -> None:
    class BadCtx:
        async def __aenter__(self) -> AsyncSession:  # type: ignore[override]
            raise RuntimeError("fail to open session")

        async def __aexit__(
            self,
            exc_type: type[BaseException] | None,
            exc: BaseException | None,
            tb: types.TracebackType | None,
        ) -> bool:  # type: ignore[override]
            return False

    def bad_session(_self: Any) -> BadCtx:  # type: ignore[no-redef]
        return BadCtx()

    monkeypatch.setattr(db_manager, "got_manual_session", bad_session, raising=False)
    assert await db_manager.health_check() is False


@pytest.mark.asyncio
async def test_execute_sql_select_via_manager(db_manager: AsyncSQLiteManager) -> None:
    result = await db_manager.execute_sql("SELECT 1")
    row = result.fetchone()
    assert row is not None
    assert row[0] == 1


@pytest.mark.asyncio
async def test_aexecute_sql_with_text_and_params_and_exec_options(db_manager: AsyncSQLiteManager) -> None:
    async with db_manager.async_engine.connect() as conn:
        sql = text("SELECT :x AS val")
        result = await aexecute_sql(conn, sql, {"x": 7}, execution_options={"dummy_option": True})
        row = result.fetchone()
        assert row is not None
        assert row.val == 7


@pytest.mark.asyncio
async def test_engine_kwargs_override(sqlite_dsn: str) -> None:
    mgr = AsyncSQLiteManager(
        sqlite_dsn,
        echo=True,
        pool_pre_ping=True,
        pool_recycle=10,
        poolclass=NullPool,
    )
    try:
        assert mgr.async_engine.echo is True
        assert await mgr.health_check() is True
    finally:
        await mgr.close()


@pytest.mark.asyncio
async def test_close_idempotent(db_manager: AsyncSQLiteManager) -> None:
    await db_manager.close()


@pytest.mark.asyncio
async def test_configured_session_autofcl_toggle_and_restore(db_manager: AsyncSQLiteManager) -> None:
    async with db_manager.got_manual_session() as session:
        original = session.autoflush
        async with async_configured_session_temporarily(session, autoflush=not original):
            assert session.autoflush is (not original)
        assert session.autoflush is original


@pytest.mark.asyncio
async def test_configured_session_no_changes_passthrough(db_manager: AsyncSQLiteManager) -> None:
    async with db_manager.got_manual_session() as session:
        original = session.autoflush
        async with async_configured_session_temporarily(session):
            assert session.autoflush is original
        assert session.autoflush is original


@pytest.mark.asyncio
async def test_configured_session_autocommit_true_commits(monkeypatch: pytest.MonkeyPatch, db_manager: AsyncSQLiteManager) -> None:
    async with db_manager.got_manual_session() as session:
        called = {"commit": 0}

        async def fake_commit() -> None:  # type: ignore[unused-argument]
            called["commit"] += 1

        monkeypatch.setattr(session, "commit", fake_commit, raising=False)

        async with async_configured_session_temporarily(session, autocommit=True):
            pass

        assert called["commit"] == 1


@pytest.mark.asyncio
async def test_configured_session_exception_triggers_rollback_and_restore(
    monkeypatch: pytest.MonkeyPatch, db_manager: AsyncSQLiteManager
) -> None:
    async with db_manager.got_manual_session() as session:
        original = session.autoflush
        called = {"rollback": 0}

        async def fake_rollback() -> None:  # type: ignore[unused-argument]
            called["rollback"] += 1

        monkeypatch.setattr(session, "rollback", fake_rollback, raising=False)

        with pytest.raises(RuntimeError):
            async with async_configured_session_temporarily(session, autoflush=not original):
                raise RuntimeError("boom in context")

        assert called["rollback"] == 1
        assert session.autoflush is original


@pytest.mark.asyncio
async def test_aexecute_sql_with_str_no_params(db_manager: AsyncSQLiteManager) -> None:
    async with db_manager.async_engine.connect() as conn:
        result = await aexecute_sql(conn, "SELECT 1")
        row = result.fetchone()
        assert row is not None
        assert row[0] == 1


@pytest.mark.asyncio
async def test_execute_sql_with_text_and_exec_options(db_manager: AsyncSQLiteManager) -> None:
    result = await db_manager.execute_sql(text("SELECT 1"), execution_options={"dummy_option": True})
    row = result.fetchone()
    assert row is not None


@pytest.mark.asyncio
async def test_must_rollback(db_manager: AsyncSQLiteManager) -> None:
    async with db_manager.got_manual_session() as session:
        _ = await session.execute(sa.text("SELECT 1"))
        await async_must_rollback_if_in_transaction(session)
