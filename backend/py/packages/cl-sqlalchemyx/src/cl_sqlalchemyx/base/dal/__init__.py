import asyncio
import datetime
import logging
import random
from collections.abc import AsyncIterator, Awaitable, Callable, Iterable
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, ClassVar, Final, Generic, Literal, ParamSpec, TypeVar, cast

import sqlalchemy as sa
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import ColumnExpressionArgument
from sqlalchemy import event as sa_event
from sqlalchemy.exc import OperationalError as SQLAlchemyOperationalError
from sqlalchemy.ext.asyncio import AsyncAttrs, AsyncSession
from sqlalchemy.orm import DeclarativeBase, InstrumentedAttribute, Mapped, ORMExecuteState, mapped_column, with_loader_criteria
from sqlalchemy.orm import Session as SyncSession

if TYPE_CHECKING:
    from sqlalchemy.engine.interfaces import _CoreAnyExecuteParams  # pragma: no cover # pyright: ignore[reportPrivateUsage]

READONLY_SESSION_FLAG: Final[str] = "__cl_sqlalchemyx__readonly_session__"
READONLY_WRITE_BYPASS_FLAG: Final[str] = "__cl_sqlalchemyx__allow_readonly_write__"

_LOGGER = logging.getLogger(__name__)

T = TypeVar("T")
P = ParamSpec("P")
BaseModelT = TypeVar("BaseModelT", bound=BaseModel)

OPTIMISTIC_LOCK_ERROR_MSG_TRAIT: Final[str] = "乐观锁更新失败"
PESSIMISTIC_LOCK_ERROR_MSG_TRAIT: Final[str] = "悲观锁获取失败"


def filtered_in_sql_values[ValueT, TargetT](
    values: Iterable[ValueT] | None,
    target_type_as: Callable[[ValueT], TargetT] | None = None,
) -> list[TargetT]:
    if not values:
        return []

    converter = target_type_as or cast("Callable[[ValueT], TargetT]", lambda x: x)

    items: list[TargetT] = []
    seen: set[TargetT] = set()

    for item in values:
        if item is None or item == "":
            continue
        try:
            converted_value = converter(item)
            if converted_value not in seen:
                seen.add(converted_value)
                items.append(converted_value)
        except (ValueError, TypeError):
            continue

    return items


class DBRetryableError(Exception):
    """数据库可重试异常

    表示一个由于并发冲突导致的、可以通过重试解决的数据库操作异常.
    这类异常不是错误,而是正常的并发控制机制,应该被捕获并重试.

    适用场景:
    - 乐观锁冲突(版本号不匹配)
    - 悲观锁获取失败(锁等待超时、行被锁定)
    - 数据库死锁
    - 其他可通过重试解决的并发冲突

    使用方式:
        配合 @async_with_retry 装饰器或 retry_on_conflict 函数使用.

    Attributes:
        message: 异常消息,描述冲突的具体原因
    """

    def __init__(self, message: str = "数据库操作冲突,需要重试") -> None:
        super().__init__(message)
        self.message = message

    @property
    def is_pessimistic_lock_retry_error(self) -> bool:
        return PESSIMISTIC_LOCK_ERROR_MSG_TRAIT in self.message

    @property
    def is_optimistic_lock_retry_error(self) -> bool:
        return OPTIMISTIC_LOCK_ERROR_MSG_TRAIT in self.message


@asynccontextmanager
async def async_temp_set_lock_wait_timeout(
    session: AsyncSession,
    timeout_seconds: int | None,
) -> AsyncIterator[None]:
    """临时设置锁等待超时时间的上下文管理器

    在上下文内设置指定的超时时间,退出时自动恢复为默认值.

    Args:
        session: 数据库会话
        timeout_seconds: 超时时间(秒),None表示不设置

    Example:
        ```python
        async with _temporarily_set_lock_wait_timeout(session, 3):
            # 在这里执行FOR UPDATE查询,超时时间为3秒
            result = await session.execute(stmt)
        # 自动恢复默认超时时间
        ```
    """
    if timeout_seconds is None:
        yield
        return
    dialect_name = None
    try:
        bind = session.get_bind()
        if bind is not None:
            dialect_name = bind.dialect.name  # type: ignore[union-attr]
            if hasattr(bind, "sync_engine"):
                dialect_name = bind.sync_engine.dialect.name
    except Exception:
        dialect_name = None

    if dialect_name not in ("mysql", "mariadb"):
        yield
        return

    try:
        # 设置临时超时
        with suppress(Exception):
            _ = await session.execute(sa.text(f"SET SESSION innodb_lock_wait_timeout = {timeout_seconds}"))
        yield
    finally:
        # 恢复默认超时
        with suppress(Exception):
            _ = await session.execute(sa.text("SET SESSION innodb_lock_wait_timeout = DEFAULT"))


@dataclass
class RetryConfig:
    """重试配置

    配置重试策略的各项参数,支持指数退避和抖动.
    """

    max_attempts: int = 3
    initial_delay: float = 0.1
    max_delay: float = 2.0
    exponential_base: float = 2.0
    jitter: bool = True

    def __post_init__(self) -> None:
        """验证配置参数"""
        if self.max_attempts < 1:
            raise ValueError(f"max_attempts必须>=1, 当前值: {self.max_attempts}")
        if self.initial_delay < 0:
            raise ValueError(f"initial_delay必须>=0, 当前值: {self.initial_delay}")
        if self.max_delay < self.initial_delay:
            raise ValueError(f"max_delay({self.max_delay})必须>=initial_delay({self.initial_delay})")
        if self.exponential_base <= 1:
            raise ValueError(f"exponential_base必须>1, 当前值: {self.exponential_base}")

    def calculate_delay(self, attempt: int) -> float:
        """计算指定尝试次数的延迟时间"""
        if attempt <= 0:
            return 0.0

        delay = self.initial_delay * (self.exponential_base ** (attempt - 1))
        delay = min(delay, self.max_delay)

        if self.jitter and delay > 0:
            jitter_range = delay * 0.2
            delay = delay + random.uniform(-jitter_range, jitter_range)
            delay = max(0, min(delay, self.max_delay))

        return delay


DEFAULT_RETRY_CONFIG = RetryConfig(max_attempts=3, initial_delay=0.1, max_delay=1.0)


def async_with_retry(
    config: RetryConfig | None = None,
    *,
    on_conflict: Callable[[int, Exception], Awaitable[None]] | None = None,
) -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
    """数据库可重试异常统一重试装饰器

    捕获所有 DBRetryableError 及其子类(乐观锁、悲观锁等),自动重试.

    Args:
        config: 重试配置,None表示使用默认配置
        on_conflict: 冲突回调函数,在每次冲突时调用

    Returns:
        装饰器函数

    Examples:
        >>> @async_with_retry(RetryConfig(max_attempts=3))
        >>> async def update_with_lock():
        ...     # 使用乐观锁或悲观锁的操作
        ...     return await DAL.update_with_optimistic_lock(...)
        >>>
        >>> # 带冲突回调
        >>> async def log_conflict(attempt: int, error: Exception):
        ...     print(f"第{attempt}次冲突: {error}")
        >>>
        >>> @async_with_retry(on_conflict=log_conflict)
        >>> async def my_operation():
        ...     return await some_db_operation()
    """
    retry_config = config or RetryConfig()

    def decorator(func: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            last_exception: Exception | None = None

            for attempt in range(1, retry_config.max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except DBRetryableError as e:
                    last_exception = e
                    error_type = type(e).__name__
                    _LOGGER.warning(
                        "数据库操作冲突(%s),第%s/%s次尝试失败: %s, 原因: %s",
                        error_type,
                        attempt,
                        retry_config.max_attempts,
                        func.__name__,
                        e.message,
                    )

                    if on_conflict:
                        try:
                            await on_conflict(attempt, e)
                        except Exception:
                            _LOGGER.exception("冲突回调执行失败")

                    if attempt < retry_config.max_attempts:
                        delay = retry_config.calculate_delay(attempt)
                        _LOGGER.debug(f"等待{delay:.3f}秒后重试...")
                        await asyncio.sleep(delay)
                    else:
                        _LOGGER.warning(f"数据库操作重试{retry_config.max_attempts}次后仍然失败: {func.__name__}")

            if last_exception:
                raise last_exception
            raise RuntimeError(f"重试失败但未捕获异常: {func.__name__}")

        return wrapper

    return decorator


class AsyncSqlATableBase(AsyncAttrs, DeclarativeBase):
    """异步 SQLAlchemy 表基类.

    这是所有异步 SQLAlchemy 表的基类,提供异步操作支持.
    继承自 AsyncAttrs 和 DeclarativeBase,结合了异步特性和声明式映射.

    这个基类为所有继承的表类提供基本的异步 SQLAlchemy 功能,
    包括异步会话支持和声明式表定义能力.
    """


SQLATableT = TypeVar("SQLATableT", bound=AsyncSqlATableBase)


class SoftDeleteTableMixin:
    """软删除表混入类.

    为表提供软删除功能,通过设置 is_delete 字段来标记记录是否被删除,
    而不是物理删除记录.这样可以保留历史数据,便于数据恢复和审计.

    继承此混入类的表会自动应用软删除过滤器,在查询时自动过滤掉已删除的记录.

    Attributes:
        is_delete: 逻辑删除标记,0表示未删除,1表示已删除.
    """

    is_delete: Mapped[int] = mapped_column(sa.Integer, default=0, comment="逻辑删除")

    def delete(self, is_delete: int = 1) -> None:
        """标记记录为已删除状态.

        Args:
            is_delete: 删除标记值,默认为1表示删除,0表示未删除.
        """
        self.is_delete = is_delete

    def undelete(self) -> None:
        """取消删除标记,恢复记录为未删除状态."""
        self.is_delete = 0


@sa_event.listens_for(SyncSession, "before_flush")
def __receive_before_flush(session: SyncSession, fcl_context: Any, instances: Any) -> None:  # pyright: ignore[reportUnusedFunction, reportUnusedParameter]
    """在执行 flush 操作时,将已删除的记录标记为逻辑删除.

    这个事件监听器会在 SQLAlchemy 会话执行 flush 操作之前被调用,
    它会遍历所有被标记为删除的对象,如果对象继承自 SoftDeleteTableMixin,
    则将其标记为逻辑删除而不是物理删除.

    Args:
        session: SQLAlchemy 会话对象.
        fcl_context: flush 上下文信息.
        instances: 实例列表(未使用).
    """
    for instance in session.deleted:
        if isinstance(instance, SoftDeleteTableMixin):
            instance.delete()
            session.add(instance)


@sa_event.listens_for(SyncSession, "do_orm_execute")
def __add_filtering_criteria(execute_state: ORMExecuteState) -> None:  # pyright: ignore[reportUnusedFunction]
    """为所有 SELECT 查询自动添加 is_delete = 0 的过滤条件.

    这个事件监听器会在 SQLAlchemy 执行 ORM 查询时被调用,
    它会自动为所有 SELECT 查询添加 is_delete = 0 的过滤条件,
    从而自动过滤掉软删除的记录.

    NOTE: 可以使用 select(?).execution_options(include_soft_deleted=True) 绕开这个限制

    Args:
        execute_state: ORM 执行状态对象.
    """
    if (
        not execute_state.is_column_load
        and not execute_state.is_relationship_load
        # NOTE: 可以使用 select(-).execution_options(include_soft_deleted=True) 绕开这个限制
        and not execute_state.execution_options.get("include_soft_deleted", False)
        and execute_state.statement.is_select
    ):
        execute_state.statement = execute_state.statement.options(
            with_loader_criteria(
                SoftDeleteTableMixin,
                lambda t: t.is_delete == 0,
                include_aliases=True,
            )
        )


class BaseCU[SQLATableT](BaseModel):
    """创建/更新模型基类.

    CU ([C]reate/[U]pdate) 基类,支持将 CU 对象转换为 SQLAlchemy 创建对象所需的字典信息.
    使用类型参数来获取对应的表类型,实现类型安全的自动转换.

    子类需要设置 _Table 类变量来指定对应的 SQLAlchemy 表类型.

    Attributes:
        _Table: 对应的 SQLAlchemy 表类型,子类必须设置此变量.

    Example:
        >>> class UserCU(BaseCU[UserTable]):
        ...     _Table = UserTable
        ...     name: str
        ...     email: str
        >>>
        >>> cu = UserCU(name="John", email="john@example.com")
        >>> user_instance = cu.to_sqla_model()
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    # 子类必须设置这个类变量
    _Table: ClassVar[type[SQLATableT]]  # pyright: ignore[reportGeneralTypeIssues]

    def to_sqla_model(self) -> SQLATableT:
        """将 CU 对象转换为对应的 SQLAlchemy 模型实例.

        默认实现:直接使用 pydantic model_dump 转换为字典,然后用 TableClass 初始化.
        子类可以根据自己的情况重载实现.

        Returns:
            对应的 SQLAlchemy 模型实例.

        Note:
            会排除未设置的字段和 id 字段,避免覆盖数据库生成的值.
        """
        model_data = self.model_dump(exclude_unset=True, exclude={"id"})
        return self._Table(**model_data)


CUModelT = TypeVar("CUModelT", bound=BaseCU[Any])


class BaseDTO[CUModelT](BaseModel):
    """数据传输对象基类.

    DTO (Data Transfer Object) 基类,用于从数据库实体转换为传输对象.
    支持从 SQLAlchemy 模型实例自动转换,并提供转换为 CU 对象的便捷方法.

    Attributes:
        _CU: 对应的 CU 类型,用于转换为创建/更新对象.

    Example:
        >>> class UserDTO(BaseDTO[UserCU]):
        ...     _CU = UserCU
        ...     id: int
        ...     name: str
        ...     email: str
        >>>
        >>> dto = UserDTO.model_validate(user_instance)
        >>> cu = dto.to_cu()
    """

    model_config = ConfigDict(from_attributes=True)

    _CU: ClassVar[type[CUModelT]]  # pyright: ignore[reportGeneralTypeIssues]

    def to_cu(self) -> CUModelT:
        """转换为对应的 CU 对象.

        Returns:
            对应的 CU 对象实例,可用于数据库更新操作.
        """
        return self._CU.model_validate(self)


DTOModelT = TypeVar("DTOModelT", bound=BaseDTO[Any] | BaseModel)


class StdBaseCU(BaseCU[SQLATableT]):
    """标准 CU 基类:包含标准字段的 CU 类.

    对应 StdAsyncBaseTable 的 CU 版本,自动包含 create_operator_id 等标准字段.
    为标准化的创建/更新操作提供统一的字段结构.

    Attributes:
        create_operator_id: 创建人ID,默认为0.
        update_operator_id: 修改人ID,可为空.
    """

    # 标准字段
    create_operator_id: int = 0
    update_operator_id: int | None = None


def escape_like(value: str, escape_char: str = "\\") -> tuple[str, str]:
    """转义用于 SQL LIKE 的特殊字符并返回转义后的值和转义字符.

    SQL LIKE 操作符中的特殊字符(% 和 _)需要转义以避免被当作通配符处理.
    此函数会转义这些特殊字符,并返回转义后的字符串和使用的转义字符.

    Args:
        value: 需要转义的原始字符串.
        escape_char: 转义字符,默认为反斜杠 "\\".

    Returns:
        tuple[str, str]: (转义后的字符串, 使用的转义字符).

    Examples:
        >>> escape_like("test%value")
        ('test\\\\%value', '\\\\')
        >>> escape_like("test_value", "#")
        ('test#value', '#')
    """
    v = value.replace(escape_char, escape_char + escape_char)
    v = v.replace("%", escape_char + "%").replace("_", escape_char + "_")
    return v, escape_char


class AsyncRawReadDAL:
    """原始只读数据访问层.

    提供执行只读 SQL 查询的基础功能.与普通的 execute_sql 相比,
    此类方法明确标识为只读操作,可以在子类中添加额外的只读检查,
    并禁止执行修改数据的 SQL 语句.
    """

    @classmethod
    async def execute_readonly_sql(
        cls,
        session: AsyncSession,
        sql: str | sa.TextClause,
        params: "_CoreAnyExecuteParams | None" = None,
    ) -> sa.Result[Any]:
        """执行只读 SQL 查询.

        执行只读 SQL 查询,并检查 SQL 语句是否为只读操作.
        相比 execute_sql,这个方法提供以下特性:
        1. 明确标识为只读操作
        2. 可以在子类中添加额外的只读检查
        3. 不允许执行修改数据的 SQL 语句

        Args:
            session: 异步数据库会话.
            sql: SQL 字符串或 TextClause 对象.
            params: SQL 参数绑定.

        Returns:
            SQLAlchemy 执行结果对象.

        Raises:
            RuntimeError: 当 SQL 语句包含写操作关键字时抛出.
        """
        if params is None:
            params = {}

        stmt = sql if isinstance(sql, sa.TextClause) else sa.text(sql)

        # 基础实现:检查SQL是否为只读操作
        sql_str = str(stmt).upper().strip()
        write_keywords = ["INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE", "REPLACE"]
        for keyword in write_keywords:
            if sql_str.startswith(keyword):
                raise RuntimeError(f"只读DAL不允许执行写入操作SQL: {keyword}")

        return await session.execute(stmt, params)

    @classmethod
    async def _iter_records(
        cls,
        session: AsyncSession,
        table_class: type[SQLATableT],
        *,
        where_clauses: list[ColumnExpressionArgument[bool]] | None = None,
        with_deleted: bool = False,
        batch_size: int = 500,
    ) -> AsyncIterator[SQLATableT]:
        """迭代记录的核心实现(私有方法).

        被 ReadDAL.iter_record_dtos 和 WriteDAL.iter_records 共享使用.
        使用游标分页(keyset pagination)技术高效迭代大数据集,按 id 降序迭代以避免数据不一致.

        Args:
            session: 异步数据库会话.
            table_class: 要查询的表类,必须有 id 字段.
            where_clauses: WHERE 条件列表,用于过滤记录.如为 None 则不过滤.
            with_deleted: 是否包含软删除的记录.默认为 False,只返回未删除记录.
            batch_size: 每批查询的记录数,默认为 500.

        Yields:
            ATableT: 数据表记录对应的实体对象.

        Raises:
            ValueError: 当表没有 id 字段时抛出.

        Note:
            为避免迭代过程中数据新增导致的错乱,始终按 id DESC 排序并使用 id 进行游标分页.
        """
        # 强制检查表必须有 id 字段
        if not hasattr(table_class, "id") or not isinstance(getattr(table_class, "id", None), InstrumentedAttribute):
            raise ValueError(f"表 {table_class.__name__} 必须有 id 字段才能使用迭代方法")

        # 获取 id 字段用于游标分页
        id_attr = cast("InstrumentedAttribute[Any]", getattr(table_class, "id"))  # noqa: B009

        last_id: Any = None

        while True:
            # 构建基础查询
            stmt = sa.select(table_class)

            # 应用 WHERE 条件
            if where_clauses:
                for clause in where_clauses:
                    stmt = stmt.where(clause)

            # 应用游标分页:使用 id < last_id (因为是 DESC 排序)
            if last_id is not None:
                stmt = stmt.where(id_attr < last_id)

            # 应用排序: id DESC
            stmt = stmt.order_by(id_attr.desc())

            # 限制批次大小
            stmt = stmt.limit(batch_size)

            # 软删除控制
            if with_deleted:
                stmt = stmt.execution_options(include_soft_deleted=True)

            # 执行查询
            result = await session.execute(stmt)
            batch = result.scalars().all()

            # 如果没有更多记录,结束迭代
            if not batch:
                break

            # 逐条 yield 实体对象
            for entity in batch:
                yield entity

            # 更新游标值:使用最后一条记录的 id
            last_id = getattr(batch[-1], id_attr.key)


class AsyncReadDAL[SQLATableT, DTOModelT](AsyncRawReadDAL):
    """抽象只读数据访问层基类.

    定义所有读取相关的操作接口,包括:
    - 查询操作 (get_by_id, get_all, count, exists)
    - DTO 转换操作 (ret_dto_after_*)
    - 安全的 SQL 执行 (execute_readonly_sql)
    - 工具方法 (escape_like)

    子类需要设置 _Table 和 _DTO 类变量来指定对应的表类型和 DTO 类型.

    Attributes:
        _Table: 对应的 SQLAlchemy 表类型.
        _DTO: 对应的 DTO 类型.
    """

    _Table: ClassVar[type[SQLATableT]]  # pyright: ignore[reportGeneralTypeIssues]
    _DTO: ClassVar[type[DTOModelT]]  # pyright: ignore[reportGeneralTypeIssues]

    @classmethod
    async def get_by_id(
        cls,
        session: AsyncSession,
        entity_id: int,
    ) -> SQLATableT | None:
        """根据 ID 查询实体.

        Args:
            session: 异步数据库会话.
            entity_id: 实体主键 ID.

        Returns:
            实体实例,如果不存在则返回 None.
        """
        return await session.get(cls._Table, entity_id)

    @classmethod
    async def batch_get_field__entity(
        cls,
        session: AsyncSession,
        *,
        field_name: str,
        field_values: Iterable[T],
        field_value_type_as: Callable[[T], T] = lambda x: x,
    ) -> dict[T, SQLATableT]:
        """批量获取实体对象,以指定字段的值作为字典的键.

        根据指定的字段名和字段值列表,批量查询数据库并返回实体字典.
        自动过滤无效值,并将查询结果以字段值为键、实体对象为值的方式返回.

        Args:
            session: 异步数据库会话.
            field_name: 用于查询和作为字典键的字段名.
            field_values: 字段值列表,用于IN查询.

        Returns:
            字段值到实体对象的映射字典.如果输入为空,则返回空字典.

        Example:
            >>> entities = await cls.batch_get_field__entity(session, field_name="name", field_values=["alice", "bob"])
            >>> # 返回 {"alice": <Entity>, "bob": <Entity>}
        """
        filtered_field_values = filtered_in_sql_values(
            field_values,
            field_value_type_as,
        )
        if not filtered_field_values:
            return {}
        stmt = sa.select(cls._Table).where(getattr(cls._Table, field_name).in_(filtered_field_values))
        result = await session.execute(stmt)
        return {getattr(row, field_name): row for row in result.scalars().all()}

    @classmethod
    async def batch_get_id__entity(
        cls,
        session: AsyncSession,
        entity_ids: Iterable[int],
    ) -> dict[int, SQLATableT]:
        """批量获取实体对象,以ID作为字典的键.

        根据实体ID列表批量查询数据库,返回以ID为键的实体字典.

        Args:
            session: 异步数据库会话.
            entity_ids: 实体ID列表.

        Returns:
            ID到实体对象的映射字典.如果输入为空,则返回空字典.

        Example:
            >>> entities = await cls.batch_get_id__entity(session, [1, 2, 3])
            >>> # 返回 {1: <Entity>, 2: <Entity>, 3: <Entity>}
        """
        return await cls.batch_get_field__entity(
            session,
            field_name="id",
            field_values=entity_ids,
            field_value_type_as=int,
        )

    @classmethod
    async def batch_get_field__dto(
        cls,
        session: AsyncSession,
        *,
        field_name: str,
        field_values: Iterable[T],
    ) -> dict[T, DTOModelT]:
        """批量获取DTO对象,以指定字段的值作为字典的键.

        根据指定的字段名和字段值列表,批量查询数据库并返回DTO字典.

        Args:
            session: 异步数据库会话.
            field_name: 用于查询和作为字典键的字段名.
            field_values: 字段值列表,用于IN查询.

        Returns:
            字段值到DTO对象的映射字典.如果输入为空,则返回空字典.

        Example:
            >>> dtos = await cls.batch_get_field__dto(session, field_name="name", field_values=["alice", "bob"])
            >>> # 返回 {"alice": <DTO>, "bob": <DTO>}
        """
        return {
            field_value: cls._DTO.model_validate(entity)
            for field_value, entity in (
                await cls.batch_get_field__entity(
                    session,
                    field_name=field_name,
                    field_values=field_values,
                )
            ).items()
        }

    @classmethod
    async def batch_get_id__dto(
        cls,
        session: AsyncSession,
        entity_ids: Iterable[int],
    ) -> dict[int, DTOModelT]:
        """批量获取DTO对象,以ID作为字典的键.

        根据实体ID列表批量查询数据库,返回以ID为键的DTO字典.

        Args:
            session: 异步数据库会话.
            entity_ids: 实体ID列表.

        Returns:
            ID到DTO对象的映射字典.如果输入为空,则返回空字典.

        Example:
            >>> dtos = await cls.batch_get_id__dto(session, [1, 2, 3])
            >>> # 返回 {1: <DTO>, 2: <DTO>, 3: <DTO>}
        """
        return await cls.batch_get_field__dto(
            session,
            field_name="id",
            field_values=entity_ids,
        )

    @classmethod
    async def ret_dto_after_get_by_id(
        cls,
        session: AsyncSession,
        entity_id: int,
        need_refresh: bool = True,
    ) -> DTOModelT | None:
        """根据 ID 查询并返回 DTO.

        Args:
            session: 异步数据库会话.
            entity_id: 实体主键 ID.
            need_refresh: 是否刷新实体以获取最新数据.

        Returns:
            DTO 实例,如果实体不存在则返回 None.
        """
        entity = await session.get(cls._Table, entity_id)
        if entity:
            if need_refresh:
                await session.refresh(entity)
            return cls._DTO.model_validate(entity)
        return None

    @classmethod
    async def get_all(cls, session: AsyncSession, skip: int = 0, limit: int = 100) -> list[DTOModelT]:
        """获取所有实体(分页).

        Args:
            session: 异步数据库会话.
            skip: 跳过的记录数,用于分页.
            limit: 返回的最大记录数,默认为 100.

        Returns:
            DTO 实例列表.
        """
        stmt = sa.select(cls._Table).offset(skip).limit(limit)
        result = await session.execute(stmt)
        entities = result.scalars().all()
        return [cls._DTO.model_validate(entity) for entity in entities]

    @classmethod
    async def count(cls, session: AsyncSession) -> int:
        """统计实体总数.

        Args:
            session: 异步数据库会话.

        Returns:
            实体总数.
        """
        stmt = sa.select(sa.func.count()).select_from(cls._Table)
        result = await session.execute(stmt)
        return result.scalar() or 0

    @classmethod
    async def exists(cls, session: AsyncSession, entity_id: int) -> bool:
        """检查实体是否存在.

        Args:
            session: 异步数据库会话.
            entity_id: 实体主键 ID.

        Returns:
            如果实体存在返回 True,否则返回 False.
        """
        entity = await session.get(cls._Table, entity_id)
        return entity is not None

    @classmethod
    async def get_by_id_for_update(
        cls,
        session: AsyncSession,
        entity_id: int,
        *,
        lock_wait_timeout: int | None = None,
    ) -> SQLATableT | None:
        """根据ID使用悲观锁获取单个实体

        执行SELECT ... FOR UPDATE根据ID查询.

        Args:
            session: 数据库会话
            entity_id: 实体ID
            lock_wait_timeout: 锁等待超时时间(秒),仅在此查询生效.None表示使用会话默认值.

        Returns:
            实体对象或None(不存在或被锁定)

        Raises:
            DBRetryableError: 锁等待超时或获取锁失败

        Examples:
            >>> entity = await DispatchDAL.get_by_id_for_update(session, 123, lock_wait_timeout=3)
        """
        try:
            async with async_temp_set_lock_wait_timeout(session, lock_wait_timeout):
                stmt = (
                    sa.select(cls._Table)
                    .where(cls._Table.id == entity_id)  # pyright: ignore[reportUnknownMemberType, reportAttributeAccessIssue, reportUnknownArgumentType]
                    .with_for_update()
                )
                result = await session.execute(stmt)
                return result.scalar_one_or_none()
        except SQLAlchemyOperationalError as e:
            # 捕获锁等待超时等OperationalError并转换为自定义异常
            error_msg = str(e.orig) if hasattr(e, "orig") else str(e)
            if "Lock wait timeout exceeded" in error_msg or "1205" in error_msg:
                raise DBRetryableError(f"{PESSIMISTIC_LOCK_ERROR_MSG_TRAIT}-锁等待超时(entity_id={entity_id}): {error_msg}") from e
            # 其他OperationalError直接抛出
            raise

    @classmethod
    async def batch_get_for_update(
        cls,
        session: AsyncSession,
        entity_ids: Iterable[int],
        *,
        lock_wait_timeout: int | None = None,
    ) -> list[SQLATableT]:
        """批量使用悲观锁获取实体

        对多个实体ID执行SELECT ... FOR UPDATE.

        Args:
            session: 数据库会话
            entity_ids: 实体ID列表
            lock_wait_timeout: 锁等待超时时间(秒),仅在此查询生效.None表示使用会话默认值.

        Returns:
            实体列表,可能少于请求的ID数量(不存在或被锁定)

        Raises:
            DBRetryableError: 锁等待超时或获取锁失败

        Examples:
            >>> entities = await DispatchDAL.batch_get_for_update(session, [1, 2, 3], lock_wait_timeout=3)
            >>> # 返回未被锁定的实体,锁等待最多3秒
        """
        filtered_ids = filtered_in_sql_values(entity_ids, int)
        if not filtered_ids:
            return []

        try:
            async with async_temp_set_lock_wait_timeout(session, lock_wait_timeout):
                stmt = (
                    sa.select(cls._Table)
                    .where(cls._Table.id.in_(filtered_ids))  # pyright: ignore[reportUnknownMemberType, reportAttributeAccessIssue, reportUnknownArgumentType]
                    .with_for_update()
                )
                result = await session.execute(stmt)
                return list(result.scalars().all())
        except SQLAlchemyOperationalError as e:
            # 捕获锁等待超时等OperationalError并转换为自定义异常
            error_msg = str(e.orig) if hasattr(e, "orig") else str(e)
            if "Lock wait timeout exceeded" in error_msg or "1205" in error_msg:
                raise DBRetryableError(f"{PESSIMISTIC_LOCK_ERROR_MSG_TRAIT}-批量锁等待超时(entity_ids={filtered_ids}): {error_msg}") from e
            # 其他OperationalError直接抛出
            raise

    @classmethod
    async def get_one_for_update(
        cls,
        session: AsyncSession,
        *,
        where_clauses: list[ColumnExpressionArgument[bool]],
        lock_wait_timeout: int | None = None,
    ) -> SQLATableT | None:
        """根据条件使用悲观锁获取单个实体

        使用自定义WHERE条件执行SELECT ... FOR UPDATE.

        Args:
            session: 数据库会话
            where_clauses: WHERE条件列表
            lock_wait_timeout: 锁等待超时时间(秒),仅在此查询生效.None表示使用会话默认值.

        Returns:
            满足条件的第一个实体或None

        Raises:
            DBRetryableError: 锁等待超时或获取锁失败

        Examples:
            >>> dispatch = await DispatchDAL.get_one_for_update(
            ...     session,
            ...     where_clauses=[
            ...         DispatchTable.stage == DispatchStage.INIT,
            ...         DispatchTable.generator_id == generator_id,
            ...     ],
            ... )

        Note:
            - 如果有多条记录满足条件,只返回第一条
            - 建议添加ORDER BY以确保结果可预测
        """
        try:
            async with async_temp_set_lock_wait_timeout(session, lock_wait_timeout):
                stmt = sa.select(cls._Table).with_for_update()

                for clause in where_clauses:
                    stmt = stmt.where(clause)

                result = await session.execute(stmt)
                return result.scalar_one_or_none()
        except SQLAlchemyOperationalError as e:
            # 捕获锁等待超时等OperationalError并转换为自定义异常
            error_msg = str(e.orig) if hasattr(e, "orig") else str(e)
            if "Lock wait timeout exceeded" in error_msg or "1205" in error_msg:
                raise DBRetryableError(f"{PESSIMISTIC_LOCK_ERROR_MSG_TRAIT}-条件锁等待超时: {error_msg}") from e
            # 其他OperationalError直接抛出
            raise

    @classmethod
    async def iter_record_dtos(
        cls,
        session: AsyncSession,
        *,
        where_clauses: list[ColumnExpressionArgument[bool]] | None = None,
        with_deleted: bool = False,
        batch_size: int = 500,
    ) -> AsyncIterator[DTOModelT]:
        """异步迭代数据表记录并返回 DTO 对象.

        使用游标分页(keyset pagination)技术高效迭代大数据集,避免传统 OFFSET 分页的性能问题.
        按 id 字段降序迭代,支持条件过滤.

        Args:
            session: 异步数据库会话.
            where_clauses: WHERE 条件列表,用于过滤记录.如为 None 则不过滤.
            with_deleted: 是否包含软删除的记录.默认为 False,只返回未删除记录.
            batch_size: 每批查询的记录数,默认为 500.

        Yields:
            数据表记录对应的 DTO 对象.

        Raises:
            ValueError: 当表没有 id 字段时抛出.

        Examples:
            基础迭代::

                async for dto in UserDAL.iter_record_dtos(session):
                    print(dto.name)

            带过滤条件的迭代::

                async for dto in UserDAL.iter_record_dtos(session, where_clauses=[UserTable.status == 1], batch_size=100):
                    process(dto)

            包含软删除记录::

                async for dto in UserDAL.iter_record_dtos(session, with_deleted=True):
                    print(dto.id, dto.is_delete)

        Note:
            表必须有 id 字段才能使用此方法.
            始终按 id DESC 排序并使用 id 进行游标分页,避免迭代过程中数据新增导致的错乱.
            软删除过滤通过 execution_options(include_soft_deleted=True) 控制.
            每批自动转换为 DTO,减少内存占用.
        """
        # 调用核心实现迭代实体,然后转换为 DTO
        async for entity in cls._iter_records(
            session,
            cls._Table,
            where_clauses=where_clauses,
            with_deleted=with_deleted,
            batch_size=batch_size,
        ):
            yield cls._DTO.model_validate(entity)


class AsyncRawDAL:
    """原始数据访问层.

    提供执行原始 SQL 语句的基础功能,支持在 ORM 会话上下文中运行,
    并参与当前事务.适用于需要直接执行 SQL 的场景.
    """

    @classmethod
    async def execute_sql(
        cls,
        session: AsyncSession,
        sql: str | sa.TextClause,
        params: "_CoreAnyExecuteParams | None" = None,
    ) -> sa.Result[Any]:
        """通过 AsyncSession 执行原始 SQL.

        在 ORM 会话上下文中运行,并参与当前事务.


        Args:
            session: 活跃的 SQLAlchemy 异步会话.
            sql: 原始 SQL 字符串或 TextClause 对象.
            params: 绑定参数字典或列表.

        Returns:
            SQLAlchemy 执行结果对象.
        """
        if params is None:
            params = {}

        stmt = sql if isinstance(sql, sa.TextClause) else sa.text(sql)
        return await session.execute(stmt, params)


class AsyncWriteDAL[SQLATableT, DTOModelT, CUModelT](AsyncRawDAL, AsyncRawReadDAL):
    """写入数据访问层基类.

    提供所有写入相关操作的抽象基类,包括创建、更新、删除等操作.
    继承自 RawDAL 和 RawReadDAL,支持执行原始 SQL 和记录迭代,同时提供更高层次的 CRUD 操作.

    子类需要设置 _Table、_DTO 和 _CU 类变量来指定对应的类型.

    Attributes:
        _Table: 对应的 SQLAlchemy 表类型.
        _DTO: 对应的 DTO 类型.
        _CU: 对应的 CU (创建/更新) 类型.
    """

    _Table: ClassVar[type[SQLATableT]]  # pyright: ignore[reportGeneralTypeIssues]
    _DTO: ClassVar[type[DTOModelT]]  # pyright: ignore[reportGeneralTypeIssues]
    _CU: ClassVar[type[CUModelT]]  # pyright: ignore[reportGeneralTypeIssues]

    @classmethod
    async def create(
        cls,
        session: AsyncSession,
        cu: CUModelT,
        need_refresh: bool = True,  # NOTE: 创建后通常需要获取自增ID等服务器生成字段
    ) -> SQLATableT:
        """创建记录.

        Args:
            session: 活跃的 SQLAlchemy 异步会话.
            cu: 创建/更新值对象.
            need_refresh: 是否在刷新后刷新以获取服务器生成字段.

        Returns:
            创建的实体实例.

        Raises:
            TypeError: 如果会话被标记为只读.

        Note:
            事务提交由外部会话管理器控制,此方法仅执行 flush() 将变更发送到数据库.

        Examples:
            >>> entity = await DAL.create(session, cu)
            >>> # 事务由 got_soft_impl_auto_commit_session() 或 got_manual_session() 管理
        """
        # 只读会话防写入
        if session.info.get(READONLY_SESSION_FLAG):
            raise TypeError("当前会话被标记为只读, 不允许执行写入操作")
        entity = cu.to_sqla_model()
        session.add(entity)
        await session.flush()
        if need_refresh:
            await session.refresh(entity)
        return cast("SQLATableT", entity)

    @classmethod
    async def ret_dto_after_create(
        cls,
        session: AsyncSession,
        cu: CUModelT,
        need_refresh: bool = True,  # NOTE: 返回DTO需要最新数据,必须刷新
    ) -> DTOModelT:
        """创建记录并返回 DTO.

        Args:
            session: 活跃的 SQLAlchemy 异步会话.
            cu: 包含创建数据的 CU 对象.
            need_refresh: 是否刷新实体以获取最新数据.

        Returns:
            创建后的 DTO 实例.

        """
        entity = await cls.create(session, cu, need_refresh)
        return cls._DTO.model_validate(entity)

    @classmethod
    async def update_only_set_by_id(
        cls,
        session: AsyncSession,
        entity_id: int,
        cu: CUModelT,
        need_refresh: bool = False,  # NOTE: 更新操作通常不需要立即回读,可减少数据库round-trip
    ) -> SQLATableT | None:
        """根据 ID 更新(仅更新在 CU 中显式设置的字段).

        只更新 CU 对象中明确设置的字段,未设置的字段保持不变.
        这是一种安全的更新方式,不会意外覆盖未提供的字段.

        Args:
            session: 活跃的 SQLAlchemy 异步会话.
            entity_id: 要更新的实体 ID.
            cu: 包含更新数据的 CU 对象.
            need_refresh: 是否刷新实体以获取最新数据.

        Returns:
            更新后的实体实例,如果实体不存在则返回 None.

        Note:
            此方法仅执行 flush().
            相关方法:
            - update_full_by_id: 全量更新(根据 CU 配置直接覆盖更新)
            - update_partial_by_id: 部分更新(更多 None 覆盖行为支持)
        """
        # 只读会话防写入
        if session.info.get(READONLY_SESSION_FLAG):
            raise TypeError("当前会话被标记为只读, 不允许执行写入操作")
        entity = await session.get(cls._Table, entity_id)
        if not entity:
            return None

        update_data = cu.model_dump(exclude_unset=True, exclude={"id"})
        for key, value in update_data.items():
            if hasattr(entity, key):
                setattr(entity, key, value)

        await session.flush()
        if need_refresh:
            await session.refresh(entity)
        return entity

    @classmethod
    async def ret_dto_after_update_by_id(
        cls,
        session: AsyncSession,
        entity_id: int,
        vo: CUModelT,
        need_refresh: bool = True,  # NOTE: 返回DTO需要最新数据,必须刷新
    ) -> DTOModelT | None:
        """根据 ID 更新并返回 DTO.

        Args:
            session: 活跃的 SQLAlchemy 异步会话.
            entity_id: 要更新的实体 ID.
            vo: 包含更新数据的 CU 对象.
            need_refresh: 是否刷新实体以获取最新数据.

        Returns:
            更新后的 DTO 实例,如果实体不存在则返回 None.

        """
        entity = await cls.update_only_set_by_id(session, entity_id, vo, need_refresh)
        if entity:
            return cls._DTO.model_validate(entity)
        return None

    @staticmethod
    def _ensure_strict_fields(
        *,
        provided_keys: set[str],
        allowed_names: set[str] | None,
        strict: bool,
    ) -> None:
        """严格校验字段权限.

        当 strict=True 且限定了 allowed_names 时,如果出现未允许的字段则抛出异常.
        用于确保只有被允许的字段才能被更新,提供字段级别的访问控制.

        Args:
            provided_keys: 提供的字段名集合.
            allowed_names: 允许的字段名集合,为 None 表示不限制.
            strict: 是否启用严格模式.

        Raises:
            ValueError: 当出现未允许的字段时抛出.
        """
        if not strict or allowed_names is None:
            return
        not_allowed = [k for k in provided_keys if k not in allowed_names]
        if not_allowed:
            raise ValueError(f"出现未允许更新的字段: {not_allowed}")

    @classmethod
    async def update_full_by_id(
        cls,
        session: AsyncSession,
        entity_id: int,
        cu: CUModelT,
        *,
        need_refresh: bool = False,  # NOTE: 全量更新后通常不需要立即回读
        strict_missing: bool = True,  # NOTE: 严格模式防止字段缺失导致的静默覆盖,保持安全性
    ) -> SQLATableT | None:
        """全量更新:以 CU 的字段为准进行覆盖.

        将 CU 对象中的所有字段(除 id 外)写回到实体,实现全量更新.
        这会覆盖实体中对应的所有字段,无论之前的值是什么.

        Args:
            session: 活跃的 SQLAlchemy 异步会话.
            entity_id: 要更新的实体 ID.
            cu: 包含完整更新数据的 CU 对象.
            need_refresh: 是否刷新实体以获取最新数据.
            strict_missing: 是否严格检查字段缺失,默认为 True.

        Returns:
            更新后的实体实例,如果实体不存在则返回 None.

        Note:

            - 不使用 exclude_unset,将 CU 中的所有字段(除 id)写回到实体
            - strict_missing 针对必须字段(如 Pydantic 必填)天然受校验约束;
              此处额外约束可选字段缺失的容忍度
        """
        if session.info.get(READONLY_SESSION_FLAG):
            raise TypeError("当前会话被标记为只读, 不允许执行写入操作")

        entity = await session.get(cls._Table, entity_id)
        if not entity:
            return None

        # 拿到 CU 的完整字段集(包含默认值), 排除 id
        update_data: dict[str, Any] = cu.model_dump(exclude={"id"})

        # 简单的 strict_missing 保护: 若出现字段名在模型中声明, 但取值 KeyError(理论上不会出现)时抛错
        if strict_missing:
            declared_fields = set(cu.__class__.model_fields.keys()) - {"id"}
            missing_declared = [k for k in declared_fields if k not in update_data]
            if missing_declared:
                raise ValueError(f"缺少必须字段: {missing_declared}")

        for key, value in update_data.items():
            if hasattr(entity, key):
                setattr(entity, key, value)

        await session.flush()
        if need_refresh:
            await session.refresh(entity)
        return entity

    @classmethod
    async def update_partial_by_id(
        cls,
        session: AsyncSession,
        entity_id: int,
        cu: CUModelT,
        *,
        need_refresh: bool = False,  # NOTE: 部分更新后通常不需要立即回读
        fields: set[InstrumentedAttribute[Any]] | set[sa.Column[Any]] | None = None,  # NOTE: 建议在生产环境中明确指定允许更新的字段集合
        none_policy: Literal["ignore", "allow", "forbid"] = "ignore",  # NOTE: 默认忽略None值是PATCH语义的最安全策略
        none_policy_overrides: dict[InstrumentedAttribute[Any] | sa.Column[Any], Literal["ignore", "allow", "forbid"]] | None = None,
        strict: bool = False,  # NOTE: 当指定fields时建议设为True以防越权更新
    ) -> SQLATableT | None:
        """部分更新: 仅更新显式提供的字段, 并受字段白名单与 None 策略控制.

        参数:
            fields: 允许更新的字段集合(InstrumentedAttribute/Column).None 表示不限制.
            none_policy: 全局 None 策略, 默认 ignore.
            none_policy_overrides: 逐字段覆盖全局 None 策略.
            strict: 为 True 时, 若 CU 提供了 fields 未允许的字段, 则抛错.

        """
        if session.info.get(READONLY_SESSION_FLAG):
            raise TypeError("当前会话被标记为只读, 不允许执行写入操作")

        entity = await session.get(cls._Table, entity_id)
        if not entity:
            return None

        # 仅更新显式提供的字段
        update_data: dict[str, Any] = cu.model_dump(exclude_unset=True, exclude={"id"})

        # 允许字段名集合
        allowed_names: set[str] | None = None
        if fields is not None:
            allowed_names = set()
            for f in fields:
                if isinstance(f, InstrumentedAttribute):
                    allowed_names.add(f.key)
                elif isinstance(f, sa.Column):
                    allowed_names.add(f.name)
                else:
                    allowed_names.add(str(f))

        # overrides 名称映射
        overrides_by_name: dict[str, Literal["ignore", "allow", "forbid"]] = {}
        if none_policy_overrides:
            for f, pol in none_policy_overrides.items():
                if isinstance(f, InstrumentedAttribute):
                    overrides_by_name[f.key] = pol
                elif isinstance(f, sa.Column):
                    overrides_by_name[f.name] = pol
                else:
                    overrides_by_name[str(f)] = pol

        cls._ensure_strict_fields(
            provided_keys=set(update_data.keys()),
            allowed_names=allowed_names,
            strict=strict,
        )

        for key, value in list(update_data.items()):
            if allowed_names is not None and key not in allowed_names:
                continue

            if value is None:
                field_policy = overrides_by_name.get(key, none_policy)
                if field_policy == "ignore":
                    continue
                if field_policy == "forbid":
                    raise ValueError(f"字段不允许置空: {key}")
                # allow -> 继续执行 setattr(None)

            if hasattr(entity, key):
                setattr(entity, key, value)

        await session.flush()
        if need_refresh:
            await session.refresh(entity)
        return entity

    @classmethod
    async def delete_by_id(
        cls,
        session: AsyncSession,
        entity_id: int,
    ) -> bool:
        """根据 ID 删除记录.

        Args:
            session: 活跃的 SQLAlchemy 异步会话.
            entity_id: 要删除的实体 ID.

        Returns:
            如果成功删除返回 True,如果记录不存在返回 False.

        Raises:
            TypeError: 如果会话被标记为只读.

        Note:
            事务提交由外部会话管理器控制,此方法仅执行 flush().
        """
        # 只读会话防写入
        if session.info.get(READONLY_SESSION_FLAG):
            raise TypeError("当前会话被标记为只读, 不允许执行写入操作")
        entity = await session.get(cls._Table, entity_id)
        if not entity:
            return False

        await session.delete(entity)
        await session.flush()
        return True

    @classmethod
    async def iter_records(
        cls,
        session: AsyncSession,
        *,
        where_clauses: list[ColumnExpressionArgument[bool]] | None = None,
        with_deleted: bool = False,
        batch_size: int = 500,
    ) -> AsyncIterator[SQLATableT]:
        """异步迭代数据表记录并返回实体对象.

        使用游标分页(keyset pagination)技术高效迭代大数据集,避免传统 OFFSET 分页的性能问题.
        按 id 字段降序迭代,支持条件过滤.
        与 iter_record_dtos 不同,此方法直接返回 SQLAlchemy 实体对象,适用于需要修改数据的场景.

        Args:
            session: 异步数据库会话.
            where_clauses: WHERE 条件列表,用于过滤记录.如为 None 则不过滤.
            with_deleted: 是否包含软删除的记录.默认为 False,只返回未删除记录.
            batch_size: 每批查询的记录数,默认为 500.

        Yields:
            数据表记录对应的实体对象.

        Raises:
            ValueError: 当表没有 id 字段时抛出.

        Examples:
            基础迭代并修改数据::

                async for entity in UserDAL.iter_records(session):
                    entity.status = 1
                await session.flush()

            带过滤条件的迭代::

                async for entity in UserDAL.iter_records(session, where_clauses=[UserTable.status == 0], batch_size=100):
                    await process(entity)

        Note:
            表必须有 id 字段才能使用此方法.
            始终按 id DESC 排序并使用 id 进行游标分页,避免迭代过程中数据新增导致的错乱.
            软删除过滤通过 execution_options(include_soft_deleted=True) 控制.
            返回的是 ORM 实体对象,可以直接修改属性.
        """
        # 直接调用核心实现
        async for entity in cls._iter_records(
            session,
            cls._Table,
            where_clauses=where_clauses,
            with_deleted=with_deleted,
            batch_size=batch_size,
        ):
            yield entity

    @classmethod
    async def batch_update_by_conditions(
        cls,
        session: AsyncSession,
        *,
        whereclause: list[ColumnExpressionArgument[bool]],
        update_data: dict[InstrumentedAttribute[Any], Any] | dict[sa.Column[Any], Any],
        updater_id: int | None = None,
    ) -> int:
        """
        批量更新记录, 自动处理更新时间和更新人字段

        Returns:
            受影响的行数

        Notes:

            此方法会自动设置 update_datetime 和 update_operator_id (如果字段存在)
            因为使用原生 SQL, 不会触发 SQLAlchemy 的 onupdate 钩子, 需要手动处理
        """

        if session.info.get(READONLY_SESSION_FLAG):
            raise TypeError("当前会话被标记为只读, 不允许执行写入操作")

        final_update_data: dict[str, Any] = {}

        for key, value in update_data.items():
            if isinstance(key, sa.Column):
                final_update_data[key.name] = value
            elif isinstance(key, InstrumentedAttribute):
                final_update_data[key.key] = value
            elif isinstance(key, str):
                final_update_data[str(key)] = value
            else:
                raise ValueError(f"不支持的更新条件类型: {type(key)}")

        if hasattr(cls._Table, "update_datetime"):
            final_update_data["update_datetime"] = sa.sql.func.now()

        if hasattr(cls._Table, "update_operator_id") and updater_id is not None:
            final_update_data["update_operator_id"] = updater_id

        stmt = sa.update(cls._Table).where(*whereclause).values(**final_update_data)

        result = await session.execute(stmt)
        await session.flush()

        return result.rowcount  # pyright: ignore[reportAttributeAccessIssue, reportUnknownMemberType, reportUnknownVariableType]

    @classmethod
    async def batch_update_by_ids(
        cls,
        session: AsyncSession,
        *,
        entity_ids: set[int] | list[int],
        update_data: dict[InstrumentedAttribute[Any], Any] | dict[sa.Column[Any], Any],
        updater_id: int | None = None,
    ) -> int:
        """
        批量更新记录, 自动处理更新时间和更新人字段 by_id

        Args:
            session: 数据库会话
            entity_ids: 要更新的实体ID集合
            update_data: 更新数据字典
            updater_id: 更新人ID

        Returns:
            受影响的行数

        Examples:
            ```python
            await SomeDAL.batch_update_by_ids(
                session=session, entity_ids=[1, 2, 3], update_data={SomeTable.status: 1, SomeTable.name: "updated"}, updater_id=999
            )
            ```


        Notes:
            此方法会自动设置一些约定好更新字段 update_datetime 和 update_operator_id (如果字段存在)
        """
        filtered_ids = filtered_in_sql_values(entity_ids, int)
        if not filtered_ids:
            return 0
        _id_column = cls._Table.id  # pyright: ignore[reportAttributeAccessIssue,reportUnknownVariableType, reportUnknownMemberType]
        return await cls.batch_update_by_conditions(
            session,
            whereclause=[_id_column.in_(filtered_ids)],  # pyright: ignore[reportUnknownMemberType]
            update_data=update_data,
            updater_id=updater_id,
        )

    @classmethod
    async def update_only_set_with_optimistic_lock(
        cls,
        session: AsyncSession,
        entity_id: int,
        cu: CUModelT,
        *,
        expected_version: int,
        need_refresh: bool = False,
        version_field: str = "version",
    ) -> SQLATableT | None:
        """使用乐观锁更新实体

        通过version字段实现乐观锁,只有当version匹配时才更新.
        更新成功后会自动递增version字段.

        如果版本号不匹配(即数据已被其他事务修改),会抛出 DBRetryableError.
        配合 @async_with_retry 装饰器可实现自动重试.

        Args:
            session: 数据库会话
            entity_id: 实体ID
            cu: 更新数据的CU对象
            expected_version: 期望的version值
            need_refresh: 是否刷新实体获取最新数据
            version_field: 版本字段名,默认为"version"

        Returns:
            更新后的实体对象

        Raises:
            TypeError: 会话被标记为只读时
            AttributeError: 表不包含指定的version字段时
            DBRetryableError: 版本号不匹配、死锁、锁超时等

        Examples:
            >>> # 基础用法
            >>> dispatch = await DispatchDAL.get_by_id(session, dispatch_id)
            >>> cu = DispatchCU(stage=DispatchStage.COMPLETED)
            >>> entity = await DispatchDAL.update_only_set_with_optimistic_lock(session, dispatch_id, cu, expected_version=dispatch.version)
            >>>
            >>> # 配合重试装饰器
            >>> @async_with_retry(config=RetryConfig(max_attempts=3))
            >>> async def update_with_retry():
            ...     dispatch = await DispatchDAL.get_by_id(session, dispatch_id)
            ...     cu = DispatchCU(stage=DispatchStage.COMPLETED)
            ...     return await DispatchDAL.update_only_set_with_optimistic_lock(
            ...         session, dispatch_id, cu, expected_version=dispatch.version
            ...     )

        Note:
            - 表必须包含version字段(BIGINT UNSIGNED)
            - version字段会自动递增(expected_version + 1)
            - 使用WHERE id = ? AND version = ? 确保原子性
            - 版本冲突时会抛出异常而非返回False,便于重试
        """
        if session.info.get(READONLY_SESSION_FLAG):
            raise TypeError("当前会话被标记为只读, 不允许执行写入操作")

        # 检查表是否有指定的version字段
        if not hasattr(cls._Table, version_field):
            raise AttributeError(f"表 {cls._Table.__name__} 不包含 {version_field} 字段,无法使用乐观锁")

        # 检查表是否有指定的version字段
        if not hasattr(cls._Table, "id"):
            raise AttributeError(f"表 {cls._Table.__name__} 不包含 id 字段,无法使用乐观锁")

        # 构建更新语句: UPDATE ... SET ..., version = version + 1 WHERE id = ? AND version = ?
        exclude_fields = {"id", version_field}
        update_data = cu.model_dump(exclude_unset=True, exclude=exclude_fields)

        if not update_data:
            return await session.get(cls._Table, entity_id)

        # 构建SET部分(使用字符串键名)
        set_values: dict[str, Any] = {key: value for key, value in update_data.items() if hasattr(cls._Table, key)}

        # 自动处理update_datetime字段
        if hasattr(cls._Table, "update_datetime"):
            set_values["update_datetime"] = sa.sql.func.now()

        # version字段自增
        version_field_value = getattr(cls._Table, version_field)
        set_values[version_field] = version_field_value + 1

        # 构建WHERE条件
        stmt = (
            sa.update(cls._Table)
            .where(cls._Table.id == entity_id)  # pyright: ignore[reportUnknownMemberType, reportAttributeAccessIssue, reportUnknownArgumentType]
            .where(version_field_value == expected_version)
            .values(**set_values)
        )

        result = await session.execute(stmt)
        await session.flush()

        # 检查是否更新成功(rowcount > 0表示有行被更新)
        if result.rowcount > 0:  # pyright: ignore[reportAttributeAccessIssue, reportUnknownMemberType]
            # 重新获取实体
            entity = await session.get(cls._Table, entity_id)
            if need_refresh and entity:
                await session.refresh(entity)
            return entity

        # rowcount == 0 表示版本冲突,抛出异常以触发重试
        raise DBRetryableError(f"{OPTIMISTIC_LOCK_ERROR_MSG_TRAIT}-版本号不匹配({entity_id=}, {expected_version=})")


class AsyncXDALOp(AsyncRawReadDAL, AsyncRawDAL):
    """扩展数据访问操作类.

    结合了 RawReadDAL 和 RawDAL 的功能,提供完整的 SQL 执行能力.
    可以执行只读和读写 SQL 操作,适用于需要灵活 SQL 执行的场景.

    这个类继承了两个基类的所有方法,可以根据需要执行各种类型的 SQL 操作.
    """


class AsyncBaseDAL(AsyncReadDAL[SQLATableT, DTOModelT], AsyncWriteDAL[SQLATableT, DTOModelT, CUModelT]):
    """基础数据访问层.

    综合了 ReadDAL 和 WriteDAL 的功能,是最常用的数据访问层基类.
    提供了完整的 CRUD 操作,包括查询、创建、更新、删除等所有基础操作.

    这个类继承了所有读取和写入相关的方法,为大多数数据访问场景提供了完整的解决方案.
    子类只需要设置 _Table、_DTO 和 _CU 类变量即可使用.
    """


class BasicAsyncBaseTable(AsyncSqlATableBase):
    """基础异步表类,提供类型化的 .x 操作接口.

    继承自 AsyncSqlATableBase,提供了基础的异步 SQLAlchemy 表功能.
    这个抽象基类为所有继承的表类提供统一的类型化接口.

    继承此类可以获得:
    - 异步操作支持
    - 类型化的字段访问
    - 统一的表定义接口

    Note:
        这是一个抽象类,不能直接实例化.
    """

    __abstract__ = True


class ReadOnlyMixin:
    """只读表标记混入类 - 基于 SQLAlchemy 事件监听系统的只读保护.

    为表提供只读保护机制,防止对标记为只读的表执行写入操作.
    这是一种推荐的只读表实现方式,具有以下优势:

    1. 更符合 SQLAlchemy 的最佳实践
    2. 在 session.flush() 时统一检查,避免 greenlet 问题
    3. 提供清晰的错误信息
    4. 性能更好,不会每次属性访问时触发检查

    使用方法:
        >>> class MyReadOnlyTable(AsyncSqlATableBase, ReadOnlyMixin):
        ...     __tablename__ = "readonly_table"
        ...     id: Mapped[int] = mapped_column(sa.Integer, primary_key=True)
        ...     name: Mapped[str] = mapped_column(sa.String(50))

    Note:
        继承此混入类的表将在执行创建、更新或删除操作时抛出 TypeError.
    """


@sa_event.listens_for(SyncSession, "before_flush")
def __prevent_readonly_write(session: SyncSession, fcl_context: Any, instances: Any) -> None:  # pyright: ignore[reportUnusedFunction, reportUnusedParameter]
    """阻止对 ReadOnlyMixin 实例的写入操作.

    在 session flush 之前检查所有待操作的对象,
    如果发现 ReadOnlyMixin 的实例,立即抛出异常阻止操作.
    这样可以确保只读表不会被意外修改.

    Args:
        session: SQLAlchemy 会话对象.
        fcl_context: flush 上下文信息.
        instances: 实例列表(未使用).
    """
    if session.info.get(READONLY_WRITE_BYPASS_FLAG) is True:
        return
    for obj in session.new.union(session.dirty).union(session.deleted):
        if isinstance(obj, ReadOnlyMixin):
            operation = "创建" if obj in session.new else "更新" if obj in session.dirty else "删除"
            raise TypeError(
                f"不允许对只读模型 '{type(obj).__name__}' 执行 {operation} 操作." + "此表已被标记为只读,请检查业务逻辑是否正确."
            )


class ReadOnlyBasicAsyncBaseTable(AsyncSqlATableBase, ReadOnlyMixin):
    """只读表基类 - 使用 ReadOnlyMixin 实现只读保护.

    结合了 AsyncSqlATableBase 和 ReadOnlyMixin 的功能,
    为只读表提供统一的基类.继承此类的表将自动获得只读保护,
    防止意外的写入操作.

    适用于:
    - 配置表
    - 历史数据表
    - 审计日志表
    - 其他不应被修改的数据表

    Note:
        这是一个抽象类,不能直接实例化.
    """

    __abstract__ = True


ReadOnlyDTOModelT = TypeVar("ReadOnlyDTOModelT", bound=BaseModel)


class ReadOnlyAsyncBaseDAL(AsyncReadDAL[SQLATableT, ReadOnlyDTOModelT]):
    """只读数据访问层基类.

    专为只读数据访问设计的 DAL 基类,继承自 ReadDAL 的所有读取功能.
    适用于需要只读数据访问的场景,如报表查询、统计分析等.
    """

    @classmethod
    def _get_dto_fields(cls, dto_class: type[BaseModelT]) -> list[str]:
        """获取 DTO 字段列表.

        Args:
            dto_class: DTO 类类型.

        Returns:
            DTO 字段名列表.
        """
        return list(dto_class.model_fields.keys())


class StdReadOnlyBasicAsyncBaseTable(ReadOnlyBasicAsyncBaseTable):
    """标准只读表基类 - 使用 ReadOnlyMixin 实现只读保护.

    结合了 ReadOnlyBasicAsyncBaseTable 的只读功能和标准字段结构.
    适用于需要标准字段且只读的数据表,如配置表、历史数据表等.

    包含的标准字段:
    - id: 主键ID(自增)
    - create_datetime: 创建时间
    - create_operator_id: 创建人ID
    - update_datetime: 修改时间
    - update_operator_id: 修改人ID

    Note:
        这是一个抽象类,不能直接实例化.
        所有继承此类的表都将自动获得只读保护.
    """

    __abstract__ = True

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)

    create_datetime: Mapped[datetime.datetime] = mapped_column(
        sa.DateTime,
        nullable=False,
        comment="创建时间",
        server_default=sa.sql.func.now(),
        server_onupdate=sa.FetchedValue(),
    )

    create_operator_id: Mapped[int] = mapped_column(
        sa.Integer,
        nullable=False,
        comment="创建人",
        default=0,
    )

    update_datetime: Mapped[datetime.datetime] = mapped_column(
        sa.DateTime,
        nullable=True,
        comment="修改时间",
        server_default=sa.sql.func.now(),
        onupdate=sa.sql.func.now(),
        server_onupdate=sa.FetchedValue(),
    )
    update_operator_id: Mapped[int | None] = mapped_column(
        sa.Integer,
        nullable=True,
        comment="修改人",
    )


class StdAsyncBaseTable(BasicAsyncBaseTable, SoftDeleteTableMixin):
    """标准异步表类:符合新规范的表应该使用这个.

    结合了 BasicAsyncBaseTable 和 SoftDeleteTableMixin 的功能,
    提供了标准化的表结构和软删除支持.这是推荐用于大多数业务表的基类.

    包含的标准字段:
    - id: 主键ID(自增)
    - create_datetime: 创建时间
    - create_operator_id: 创建人ID
    - update_datetime: 修改时间
    - update_operator_id: 修改人ID
    - is_delete: 软删除标记

    Note:
        这是一个抽象类,不能直接实例化.
    """

    __abstract__ = True

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)

    create_datetime: Mapped[datetime.datetime] = mapped_column(
        sa.DateTime,
        nullable=False,
        comment="创建时间",
        server_default=sa.sql.func.now(),
        server_onupdate=sa.FetchedValue(),
    )

    create_operator_id: Mapped[int] = mapped_column(
        sa.Integer,
        nullable=False,
        comment="创建人",
        default=0,
    )

    update_datetime: Mapped[datetime.datetime] = mapped_column(
        sa.DateTime,
        nullable=True,
        comment="修改时间",
        server_default=sa.sql.func.now(),
        onupdate=sa.sql.func.now(),
        server_onupdate=sa.FetchedValue(),
    )
    update_operator_id: Mapped[int | None] = mapped_column(
        sa.Integer,
        nullable=True,
        comment="修改人",
    )


class StdBaseDTO(BaseDTO[CUModelT]):
    """标准 DTO 基类:包含标准字段的 DTO 类.

    对应 StdAsyncBaseTable 的 DTO 版本,自动包含所有标准字段.
    为标准化的数据传输提供统一的字段结构.

    Attributes:
        id: 记录ID.
        create_datetime: 创建时间.
        create_operator_id: 创建人ID.
        update_datetime: 修改时间,可为空.
        update_operator_id: 修改人ID,可为空.
    """

    id: int = Field(..., description="ID")
    create_datetime: datetime.datetime = Field(..., description="创建时间")
    create_operator_id: int = Field(..., description="创建人")
    update_datetime: datetime.datetime | None = Field(None, description="修改时间")
    update_operator_id: int | None = Field(None, description="修改人")

    model_config = ConfigDict(from_attributes=True)


class FieldMixin:
    """字段混入类.

    提供各种字段处理功能的混入类集合.
    """

    class DataJsonBytes(Generic[BaseModelT]):
        """为 bytes 类型的 JSON 列提供简单直观的读写接口.

        在许多表中,我们将结构化数据序列化为 JSON 并以 bytes 写入数据库列(例如 LargeBinary).
        此 Mixin 提供属性 x_data_json 来完成以下工作:

        - 读取时:自动将 bytes 反序列化为 Pydantic 模型实例
        - 写入时:接受 Pydantic 模型,自动序列化为 bytes 存回原始列

        约定:
            - 子类必须具备名为 data_json 的列,类型为 bytes
            - 子类需在类属性上设置 _DATA_JSON 指向一个 Pydantic 模型类,用于强类型解析

        Attributes:
            _DATA_JSON_FIELD: 数据字段名,默认为 "data_json".
            _DATA_JSON: Pydantic 模型类,用于解析 JSON 数据.

        Example:
            >>> class MsgData(BaseModel):
            ...     text: str = ""
            >>> class MyTable(StdAsyncBaseTable, FieldMixin.DataJsonBytes[MsgData]):
            ...     __tablename__ = "t"
            ...     id: Mapped[int]
            ...     data_json: Mapped[bytes]
            >>> MyTable._DATA_JSON = MsgData  # 绑定模型
            >>> obj = MyTable()
            >>> obj.x_data_json  # 读取 -> MsgData 实例
            MsgData(text='')
            >>> obj.x_data_json = MsgData(text="hello")  # 写入 -> 自动转 bytes
        """

        _DATA_JSON_FIELD: ClassVar[str] = "data_json"
        _DATA_JSON: ClassVar[type[BaseModelT]]  # pyright: ignore[reportGeneralTypeIssues]

        @property
        def must_x_data_json(self) -> BaseModelT:
            """获取解析后的 JSON 数据,必须存在有效值.

            Returns:
                BaseModelT: 解析后的 Pydantic 模型实例.

            Raises:
                可能抛出类型转换相关的异常.
            """
            return cast("BaseModelT", self.x_data_json)

        @property
        def x_data_json(self) -> BaseModelT | None:
            """读取解析后的 JSON 数据为 Pydantic 模型.

            Returns:
                BaseModelT | None: 若已绑定 _DATA_JSON 则返回模型实例;否则返回 None.

            Example:
                >>> obj.x_data_json  # -> MsgData(text='')
                MsgData(text='')
            """
            if not hasattr(self, "_DATA_JSON"):
                return None

            raw = getattr(self, self._DATA_JSON_FIELD, None)
            if not raw:
                return self._DATA_JSON()  # type: ignore[call-arg]

            text = raw.decode() if isinstance(raw, bytes) else str(raw)

            return self._DATA_JSON.model_validate_json(text)

        @x_data_json.setter
        def x_data_json(self, value: BaseModelT | None) -> None:
            """写入 Pydantic 模型并自动序列化为 bytes.

            Args:
                value: 目标 Pydantic 模型实例;若为 None 则写入空 JSON b"{}".

            Example:
                >>> obj.x_data_json = MsgData(text="hello")
                >>> isinstance(obj.data_json, bytes)
                True
            """
            if value is None:
                setattr(self, self._DATA_JSON_FIELD, b"{}")
                return

            if isinstance(value, BaseModel):
                setattr(self, self._DATA_JSON_FIELD, value.model_dump_json().encode())
                return


__all__ = (
    "DEFAULT_RETRY_CONFIG",
    "READONLY_SESSION_FLAG",
    "AsyncBaseDAL",
    "AsyncReadDAL",
    "AsyncSqlATableBase",
    "AsyncWriteDAL",
    "AsyncXDALOp",
    "BaseCU",
    "BaseDTO",
    "BasicAsyncBaseTable",
    "DBRetryableError",
    "FieldMixin",
    "ReadOnlyAsyncBaseDAL",
    "ReadOnlyBasicAsyncBaseTable",
    "RetryConfig",
    "StdAsyncBaseTable",
    "StdBaseCU",
    "StdBaseDTO",
    "StdReadOnlyBasicAsyncBaseTable",
    "async_with_retry",
    "escape_like",
    "filtered_in_sql_values",
)
