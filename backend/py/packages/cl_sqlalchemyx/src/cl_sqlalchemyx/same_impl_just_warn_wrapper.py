import typing_extensions
from sqlalchemy.ext.asyncio import AsyncSession as _AsyncSession
from sqlalchemy.ext.asyncio import AsyncSessionTransaction


class AsyncSession(_AsyncSession):
    """
    与 `from sqlalchemy.ext.asyncio import AsyncSession` 没有实现上的区别, 用于 LSP 提示, 仅覆盖一部分不推荐使用的方法:
    NOTE: 新增实现不要修改任何行为, 以满足在某些情况可以使用 `typing.cast(sqlalchemy.ext.asyncio.AsyncSession, session)` 来满足类型提示

    1. `.begin()`: 当使用的配置如下时
    ```python
    async_sessionmaker(
        bind=self.async_engine,
        autoflush=False,  # 默认不自动刷新, 避免隐式触发了查询, NOTE: 可能需要显式调用 session.flush() 或者直接 session.commit()
        expire_on_commit=False,  # 默认不会在 commit 后让对象实例过期, 避免commit后意外隐式触发了查询, NOTE: 可能需要显式调用 session.refresh(dao)
        autocommit=False,  # 默认不自动提交事务.这是 SQLAlchemy 推荐的方式 NOTE: 需要显式调用 session.commit()
    )
    ```
    推荐使用 `.begin_nested()`, 因为该参数配置下加上sqla2.x会隐式 `.begin()`, 在逻辑代码中再次调用 `.begin()` 很容易报错 `InvalidRequestError: A transaction is already begun on this Session`.
    """

    @typing_extensions.deprecated(
        "不推荐使用.begin(), 而是使用.begin_nested(), 因为目前sqla2.x会隐式.begin, 会报错 InvalidRequestError: A transaction is already begun on this Session.",
    )
    @typing_extensions.override
    def begin(self) -> AsyncSessionTransaction:
        return super().begin()
