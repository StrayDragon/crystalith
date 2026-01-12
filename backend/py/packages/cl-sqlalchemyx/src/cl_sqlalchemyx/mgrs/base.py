from __future__ import annotations

from collections.abc import AsyncGenerator, Callable
from contextlib import asynccontextmanager, suppress
from enum import Enum
from typing import Any, Generic, TypeVar, cast

import sqlalchemy as sa
from sqlalchemy import CursorResult, TextClause, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from cl_sqlalchemyx.base.dal import READONLY_SESSION_FLAG
from cl_sqlalchemyx.same_impl_just_warn_wrapper import AsyncSession as WarnWrappedAsyncSession

SessionT = TypeVar("SessionT", AsyncSession, WarnWrappedAsyncSession)
DBEnumT = TypeVar("DBEnumT", bound=Enum)
ManagerT = TypeVar("ManagerT", bound="AsyncDBManager")


def _default_engine_kwargs(dialect_name: str) -> dict[str, Any]:
    if dialect_name == "sqlite":
        return {"poolclass": NullPool}
    return {
        "pool_size": 20,
        "max_overflow": 30,
        "pool_pre_ping": True,
        "pool_recycle": 3600,
        "echo": False,
    }


class AsyncDBManager:
    """异步数据库管理器（通用）"""

    def __init__(
        self,
        database_url: str,
        *,
        readonly_sql: str | None = "SET TRANSACTION READ ONLY",
        **engine_kwargs: Any,
    ) -> None:
        self._database_url = database_url
        self._dialect_name = make_url(database_url).get_backend_name()

        default_kwargs = _default_engine_kwargs(self._dialect_name)
        final_kwargs = default_kwargs.copy()

        if "poolclass" in engine_kwargs:
            for key in ("pool_size", "max_overflow", "pool_recycle"):
                _ = final_kwargs.pop(key, None)

        final_kwargs.update(engine_kwargs)

        if "poolclass" in final_kwargs:
            for key in ("pool_size", "max_overflow", "pool_recycle"):
                _ = final_kwargs.pop(key, None)

        self.async_engine: AsyncEngine = create_async_engine(
            database_url,
            **final_kwargs,
        )

        self.async_session_local: Callable[..., AsyncSession] = async_sessionmaker(
            bind=self.async_engine,
            autoflush=False,
            expire_on_commit=False,
            autocommit=False,
        )

        if self._dialect_name == "sqlite":
            self._readonly_sql = None
        else:
            self._readonly_sql = readonly_sql

    @property
    def dialect_name(self) -> str:
        return self._dialect_name

    @asynccontextmanager
    async def got_manual_session(self) -> AsyncGenerator[AsyncSession, None]:
        async with self.async_session_local() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    @asynccontextmanager
    async def got_soft_impl_auto_commit_session(self) -> AsyncGenerator[WarnWrappedAsyncSession, None]:
        async with self.async_session_local() as session:
            try:
                yield cast("WarnWrappedAsyncSession", session)
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    @asynccontextmanager
    async def got_readonly_session(self) -> AsyncGenerator[WarnWrappedAsyncSession, None]:
        async with self.async_session_local() as session:
            session.info[READONLY_SESSION_FLAG] = True
            try:
                if self._readonly_sql:
                    with suppress(Exception):
                        _ = await session.execute(sa.text(self._readonly_sql))
                yield cast("WarnWrappedAsyncSession", session)
                await session.rollback()
            except Exception:
                await session.rollback()
                raise
            finally:
                try:
                    session.info.pop(READONLY_SESSION_FLAG, None)
                finally:
                    await session.close()

    async def health_check(self) -> bool:
        try:
            async with self.got_manual_session() as session:
                _ = await session.execute(sa.text("SELECT 1"))
                return True
        except Exception:
            return False

    async def close(self) -> None:
        if self.async_engine:
            await self.async_engine.dispose()

    async def execute_sql(
        self,
        sql_text: str | TextClause,
        params: dict[str, Any] | list[dict[str, Any]] | None = None,
        execution_options: dict[str, Any] | None = None,
    ) -> CursorResult[Any]:
        async with self.async_engine.connect() as conn:
            return await aexecute_sql(
                conn,
                sql_text,
                params,
                execution_options,
            )


class AsyncDBManagersMapper(Generic[DBEnumT, ManagerT]):
    def __init__(
        self,
        *,
        default_name: DBEnumT,
        managers: dict[DBEnumT, ManagerT] | None = None,
        binds: dict[DBEnumT, str] | None = None,
        engine_options_default: dict[str, Any] | None = None,
        binds_engine_options: dict[DBEnumT, dict[str, Any]] | None = None,
        manager_cls: type[ManagerT] = AsyncDBManager,  # type: ignore[assignment]
    ) -> None:
        resolved: dict[DBEnumT, ManagerT] | None = managers
        if resolved is None and binds is not None:
            engine_options_default = engine_options_default or {}
            binds_engine_options = binds_engine_options or {}
            built: dict[DBEnumT, ManagerT] = {}
            for key, uri in binds.items():
                per_opts: dict[str, Any] = dict(engine_options_default)
                per_opts.update(binds_engine_options.get(key) or {})
                built[key] = manager_cls(uri, **per_opts)
            resolved = built

        if not resolved:
            raise ValueError("AsyncDBManagersMapper requires at least one manager (via managers or non-empty binds)")
        if default_name not in resolved:
            raise KeyError("Default enum not found in managers")
        self._managers: dict[DBEnumT, ManagerT] = dict(resolved)
        self._default_name: DBEnumT = default_name

    def get_manager(self, name: DBEnumT | None = None) -> ManagerT:
        key = name if name is not None else self._default_name
        try:
            return self._managers[key]
        except KeyError as exc:  # pragma: no cover
            raise KeyError(f"Unknown datasource enum: {key!r}. Known: {list(self._managers.keys())}") from exc

    async def health_check(self) -> dict[DBEnumT, bool]:
        results: dict[DBEnumT, bool] = {}
        for key, manager in self._managers.items():
            with suppress(Exception):
                results[key] = await manager.health_check()
            if key not in results:
                results[key] = False
        return results

    async def close(self) -> None:
        for manager in self._managers.values():
            with suppress(Exception):
                await manager.close()


async def aexecute_sql(
    conn: AsyncConnection,
    sql_text: str | TextClause,
    params: dict[str, Any] | list[dict[str, Any]] | None = None,
    execution_options: dict[str, Any] | None = None,
) -> CursorResult[Any]:
    if params is None:
        params = {}

    stmt = sql_text if isinstance(sql_text, TextClause) else text(sql_text)

    return await conn.execute(stmt, params, execution_options=execution_options)


@asynccontextmanager
async def async_configured_session_temporarily(
    session: SessionT,
    *,
    autoflush: bool | None = None,
    autocommit: bool | None = None,
) -> AsyncGenerator[SessionT, None]:
    original_autoflush = session.autoflush
    changed_autoflush = False

    try:
        if autoflush is not None and original_autoflush != autoflush:
            session.autoflush = autoflush
            changed_autoflush = True

        yield session

        if autocommit is True:
            await session.commit()

    except Exception:
        await session.rollback()
        raise
    finally:
        if changed_autoflush:
            session.autoflush = original_autoflush


async def async_must_rollback_if_in_transaction(session: AsyncSession | WarnWrappedAsyncSession) -> None:
    with suppress(Exception):
        if session.in_transaction():
            await session.rollback()
