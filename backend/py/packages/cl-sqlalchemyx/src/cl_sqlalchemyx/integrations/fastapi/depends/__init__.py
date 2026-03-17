"""FastAPI 依赖工厂:为数据库管理器与会话提供依赖注入工具."""

from collections.abc import AsyncIterator, Awaitable, Callable
from enum import Enum
from typing import ClassVar

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from cl_sqlalchemyx.mgrs import AsyncDBManager, AsyncDBManagersMapper
from cl_sqlalchemyx.same_impl_just_warn_wrapper import AsyncSession as WarnWrappedAsyncSession


class DBManagerMapperFastAPIDepends[DBEnumT: Enum]:
    """为 FastAPI 提供数据库管理器相关依赖.

    该工具类将 `Request.state` 中预先注入的 `AsyncDBManagersMapper`
    暴露为可复用的依赖工厂,便于在路由或依赖模块中快速获取数据库管理器与会话.
    """

    state_name: ClassVar[str] = "db_mgrs_mapper"

    @classmethod
    async def get_async_db_managers_mapper(cls, request: Request) -> AsyncDBManagersMapper[DBEnumT, AsyncDBManager]:
        """获取当前请求绑定的数据库管理器映射.

        Args:
            request (Request): FastAPI 请求对象,需要保证其 `state` 中存在管理器映射.

        Returns:
            AsyncDBManagersMapper[DBEnumT, AsyncDBManager]: 预先注入到请求状态的数据库管理器映射.
        """
        return getattr(request.state, cls.state_name)

    @classmethod
    def get_async_db_manager_by_bind_depends_factory(
        cls,
        bind: DBEnumT,
    ) -> Callable[[Request], Awaitable[AsyncDBManager]]:
        """构造指定数据库枚举的管理器依赖.

        Args:
            bind (DBEnumT): 目标数据库枚举值.

        Returns:
            Callable[[Request], Awaitable[AsyncDBManager]]: FastAPI 依赖函数,用于获取对应的数据库管理器.
        """

        async def _get_manager(request: Request) -> AsyncDBManager:
            return (await cls.get_async_db_managers_mapper(request)).get_manager(bind)

        return _get_manager

    @classmethod
    def get_async_db_manual_session(
        cls,
        bind: DBEnumT,
    ) -> Callable[[Request], AsyncIterator[AsyncSession]]:
        """构造手动提交的数据库会话依赖.

        Args:
            bind (DBEnumT): 目标数据库枚举值.

        Returns:
            Callable[[Request], AsyncIterator[AsyncSession]]: FastAPI 依赖函数,提供手动事务控制的 `AsyncSession`.

        Yields:
            AsyncSession: 需由使用方显式提交或回滚的数据库会话.
        """

        async def _get_session(request: Request) -> AsyncIterator[AsyncSession]:
            manager = await cls.get_async_db_manager_by_bind_depends_factory(bind)(request)
            async with manager.got_manual_session() as session:
                yield session

        return _get_session

    @classmethod
    def get_async_db_tx_session(
        cls,
        bind: DBEnumT,
    ) -> Callable[[Request], AsyncIterator[WarnWrappedAsyncSession]]:
        """构造自动提交的事务型会话依赖.

        Args:
            bind (DBEnumT): 目标数据库枚举值.

        Returns:
            Callable[[Request], AsyncIterator[WarnWrappedAsyncSession]]: FastAPI 依赖函数,提供自动提交的事务会话.

        Yields:
            WarnWrappedAsyncSession: 在生成器退出时自动提交的事务会话,异常时自动回滚.
        """

        async def _get_session(request: Request) -> AsyncIterator[WarnWrappedAsyncSession]:
            manager = await cls.get_async_db_manager_by_bind_depends_factory(bind)(request)
            async with manager.got_soft_impl_auto_commit_session() as session:
                yield session

        return _get_session

    @classmethod
    def get_async_db_ro_session(
        cls,
        bind: DBEnumT,
    ) -> Callable[[Request], AsyncIterator[WarnWrappedAsyncSession]]:
        """构造只读会话依赖.

        Args:
            bind (DBEnumT): 目标数据库枚举值.

        Returns:
            Callable[[Request], AsyncIterator[WarnWrappedAsyncSession]]: FastAPI 依赖函数,提供只读事务会话.

        Yields:
            WarnWrappedAsyncSession: 标记为只读并在退出时回滚的事务会话.
        """

        async def _get_session(request: Request) -> AsyncIterator[WarnWrappedAsyncSession]:
            manager = await cls.get_async_db_manager_by_bind_depends_factory(bind)(request)
            async with manager.got_readonly_session() as session:
                yield session

        return _get_session
