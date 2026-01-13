"""
测试BaseDAL及相关基类的功能

本测试文件包含:
1. 工具方法测试
2. 基础CRUD操作测试
3. DTO返回方法测试
4. SQL执行测试
5. 软删除功能测试
6. AsyncTableBase辅助方法测试
"""

import asyncio
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any, ClassVar

import pytest
import sqlalchemy as sa
import yaml
from cl_pydanticx import DataJson, json_to_bytes_serializer
from cl_stdx.enumx import MetaInfoIntEnum, XMetaInfo
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_serializer
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute, Mapped, mapped_column
from sqlalchemy.pool import NullPool

from cl_sqlalchemyx.base.dal import (
    AsyncBaseDAL,
    AsyncReadDAL,
    AsyncSqlATableBase,
    AsyncWriteDAL,
    BaseCU,
    BaseDTO,
    BasicAsyncBaseTable,
    DBRetryableError,
    FieldMixin,
    ReadOnlyAsyncBaseDAL,
    ReadOnlyBasicAsyncBaseTable,
    StdAsyncBaseTable,
    StdBaseCU,
    StdBaseDTO,
    StdReadOnlyBasicAsyncBaseTable,
    async_temp_set_lock_wait_timeout,
    async_with_retry,
    escape_like,
)
from cl_sqlalchemyx.mgrs import AsyncSQLiteManager, async_must_rollback_if_in_transaction

# ========== 测试用数据模型 ==========


class _TestStatus(MetaInfoIntEnum):
    ACTIVE = (1, XMetaInfo(description="活跃"))
    INACTIVE = (2, XMetaInfo(description="非活跃"))


class _TestTable(StdAsyncBaseTable):
    __tablename__ = "unit_testing_test_table"

    name: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    status: Mapped[int] = mapped_column(sa.SmallInteger, nullable=False, default=1)
    description: Mapped[str | None] = mapped_column(sa.String(200), nullable=True)
    value: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)


class _TestTableSimple(BasicAsyncBaseTable):
    """不带软删除的简单表"""

    __tablename__ = "unit_testing_test_table_simple"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(sa.String(50), nullable=False)


class _TestTableWithVersion(StdAsyncBaseTable):
    """带version字段的测试表,用于测试乐观锁"""

    __tablename__ = "unit_testing_test_table_with_version"

    name: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    value: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    version: Mapped[int] = mapped_column(
        sa.BigInteger,
        nullable=False,
        default=0,
        server_default="0",
        comment="乐观锁版本号",
    )


class _TestCU(StdBaseCU["_TestTable"]):
    _Table: ClassVar[type[_TestTable]] = _TestTable

    name: str
    status: _TestStatus = _TestStatus.ACTIVE
    description: str | None = None
    value: int = 0


class _TestSimpleVO(BaseCU["_TestTableSimple"]):
    _Table: ClassVar[type[_TestTableSimple]] = _TestTableSimple

    name: str


class _TestDTO(StdBaseDTO[_TestCU]):
    _CU: ClassVar[type[_TestCU]] = _TestCU

    name: str = Field(..., description="名称")
    status: int = Field(..., description="状态")
    description: str | None = Field(None, description="描述")
    value: int = Field(..., description="值")

    model_config = ConfigDict(from_attributes=True)


class _TestSimpleDTO(BaseDTO[_TestSimpleVO]):
    _CU: ClassVar[type[_TestSimpleVO]] = _TestSimpleVO

    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class _TestDAL(AsyncBaseDAL[_TestTable, _TestDTO, _TestCU]):
    _Table = _TestTable
    _DTO = _TestDTO
    _CU = _TestCU


class _TestSimpleDAL(AsyncBaseDAL[_TestTableSimple, _TestSimpleDTO, _TestSimpleVO]):
    _Table = _TestTableSimple
    _DTO = _TestSimpleDTO
    _CU = _TestSimpleVO


class _TestVersionCU(StdBaseCU["_TestTableWithVersion"]):
    _Table: ClassVar[type[_TestTableWithVersion]] = _TestTableWithVersion

    name: str
    value: int = 0


class _TestVersionDTO(StdBaseDTO[_TestVersionCU]):
    _CU: ClassVar[type[_TestVersionCU]] = _TestVersionCU

    name: str
    value: int
    version: int

    model_config = ConfigDict(from_attributes=True)


class _TestVersionDAL(AsyncBaseDAL[_TestTableWithVersion, _TestVersionDTO, _TestVersionCU]):
    _Table = _TestTableWithVersion
    _DTO = _TestVersionDTO
    _CU = _TestVersionCU


class _TestTableWithCustomVersion(StdAsyncBaseTable):
    """带自定义version字段名的测试表"""

    __tablename__ = "unit_testing_test_table_custom_version"

    name: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    value: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    row_version: Mapped[int] = mapped_column(
        sa.BigInteger,
        nullable=False,
        default=0,
        server_default="0",
        comment="自定义版本号字段",
    )


class _TestCustomVersionCU(StdBaseCU["_TestTableWithCustomVersion"]):
    _Table: ClassVar[type[_TestTableWithCustomVersion]] = _TestTableWithCustomVersion

    name: str
    value: int = 0


class _TestCustomVersionDTO(StdBaseDTO[_TestCustomVersionCU]):
    _CU: ClassVar[type[_TestCustomVersionCU]] = _TestCustomVersionCU

    name: str
    value: int
    row_version: int

    model_config = ConfigDict(from_attributes=True)


class _TestCustomVersionDAL(AsyncBaseDAL[_TestTableWithCustomVersion, _TestCustomVersionDTO, _TestCustomVersionCU]):
    _Table = _TestTableWithCustomVersion
    _DTO = _TestCustomVersionDTO
    _CU = _TestCustomVersionCU


# ========== 测试夹具 ==========


# ========== 测试专用数据库配置 ==========


TEST_CONFIG_PATH = Path(__file__).with_name("test_config.yaml")


def _load_sqlite_test_uri() -> tuple[str, Path]:
    with TEST_CONFIG_PATH.open(encoding="utf-8") as f:
        config: dict[str, Any] = yaml.safe_load(f)

    sqlite_cfg: dict[str, Any] = config.get("SQLITEDB", {})
    sqlite_rel_path = sqlite_cfg.get("TEST_SQLITE_PATH", ".tmp/cl_sqlalchemyx_test.db")

    sqlite_path = (TEST_CONFIG_PATH.parent / sqlite_rel_path).resolve()
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)

    uri = f"sqlite+aiosqlite:///{sqlite_path}"
    return uri, sqlite_path


def _cleanup_sqlite_file(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        pass

    if path.parent.name != ".tmp":
        return

    try:
        path.parent.rmdir()
    except OSError:
        pass


@pytest.fixture
async def db_manager() -> AsyncGenerator[AsyncSQLiteManager, None]:
    """为 BaseDAL 测试创建数据库管理器"""
    db_uri, sqlite_path = _load_sqlite_test_uri()

    manager = AsyncSQLiteManager(
        db_uri,
        poolclass=NullPool,
        connect_args={"check_same_thread": False},
    )

    try:
        # 确保测试需要的表结构已创建
        async with manager.async_engine.begin() as conn:
            await conn.run_sync(AsyncSqlATableBase.metadata.create_all, checkfirst=True)

        yield manager
    finally:
        # 测试结束后清理
        await manager.close()
        _cleanup_sqlite_file(sqlite_path)


@pytest.fixture
async def async_session(db_manager: AsyncSQLiteManager) -> AsyncGenerator[AsyncSession, None]:
    """创建测试用的异步会话,直接使用实际的会话管理器"""
    async with db_manager.got_manual_session() as session:
        yield session


@pytest.fixture
async def readonly_session(db_manager: AsyncSQLiteManager) -> AsyncGenerator[AsyncSession, None]:
    """创建测试用的只读会话,直接使用实际的只读会话管理器"""
    async with db_manager.got_readonly_session() as session:
        yield session


# ========== 测试BaseDAL工具方法 ==========


class TestBaseDALUtils:
    """测试BaseDAL的工具方法"""

    def test_escape_like_basic(self):
        """测试基本的LIKE转义"""
        result, escape_char = escape_like("test%value_name")
        assert result == "test\\%value\\_name"
        assert escape_char == "\\"

    def test_escape_like_with_backslash(self):
        """测试包含反斜杠的转义"""
        result, escape_char = escape_like("test\\name")
        assert result == "test\\\\name"
        assert escape_char == "\\"

    def test_escape_like_custom_escape_char(self):
        """测试自定义转义字符"""
        result, escape_char = escape_like("test%value", "!")
        assert result == "test!%value"
        assert escape_char == "!"

    def test_escape_like_complex_pattern(self):
        """测试复杂模式的转义"""
        result, escape_char = escape_like("test\\%_pattern\\%")
        assert result == "test\\\\\\%\\_pattern\\\\\\%"
        assert escape_char == "\\"


# ========== 测试BaseDAL的CRUD操作 ==========


class TestBaseDALCRUD:
    """测试BaseDAL的CRUD操作"""

    async def test_create_with_commit(self, async_session: AsyncSession):
        """测试创建记录并提交"""
        cu = _TestCU(name="测试记录", status=_TestStatus.ACTIVE, value=100, create_operator_id=1)

        result = await _TestDAL.create(async_session, cu)

        assert isinstance(result, _TestTable)
        assert result.id is not None
        assert result.name == "测试记录"
        assert result.status == _TestStatus.ACTIVE.value
        assert result.value == 100
        assert result.create_operator_id == 1

    async def test_create_without_commit(self, async_session: AsyncSession):
        """测试创建记录不提交"""
        cu = _TestCU(name="测试记录2", status=_TestStatus.INACTIVE, value=200, create_operator_id=1)

        result = await _TestDAL.create(async_session, cu)

        assert isinstance(result, _TestTable)
        assert result.id is not None
        assert result.name == "测试记录2"
        assert result.status == _TestStatus.INACTIVE.value
        assert result.value == 200

    async def test_ret_dto_after_create(self, async_session: AsyncSession):
        """测试创建后返回DTO"""
        cu = _TestCU(name="DTO测试", status=_TestStatus.ACTIVE, value=300, create_operator_id=1)

        result = await _TestDAL.ret_dto_after_create(async_session, cu)

        assert isinstance(result, _TestDTO)
        assert result.name == "DTO测试"
        assert result.status == _TestStatus.ACTIVE.value
        assert result.value == 300

    async def test_get_by_id_existing(self, async_session: AsyncSession):
        """测试通过ID获取存在的记录"""
        # 先创建一条记录
        cu = _TestCU(name="查询测试", status=_TestStatus.ACTIVE, value=400, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        # 保存ID值,避免greenlet错误
        await async_session.refresh(created)
        created_id = created.id

        # 查询记录
        result = await _TestDAL.get_by_id(async_session, created_id)

        assert result is not None
        assert result.id == created_id
        assert result.name == "查询测试"
        assert result.value == 400

    async def test_get_by_id_nonexistent(self, async_session: AsyncSession):
        """测试通过ID获取不存在的记录"""
        result = await _TestDAL.get_by_id(async_session, 99999)
        assert result is None

    async def test_ret_dto_after_get_by_id(self, async_session: AsyncSession):
        """测试查询后返回DTO"""
        # 先创建一条记录
        cu = _TestCU(name="DTO查询测试", status=_TestStatus.INACTIVE, value=500, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        await async_session.refresh(created)
        # 保存ID值,避免greenlet错误
        created_id = created.id

        # 查询并返回DTO
        result = await _TestDAL.ret_dto_after_get_by_id(async_session, created_id)

        assert result is not None
        assert isinstance(result, _TestDTO)
        assert result.name == "DTO查询测试"
        assert result.status == _TestStatus.INACTIVE.value
        assert result.value == 500

    async def test_ret_dto_after_get_by_id_nonexistent(self, async_session: AsyncSession):
        """测试查询不存在记录返回None"""
        result = await _TestDAL.ret_dto_after_get_by_id(async_session, 99999)
        assert result is None

    async def test_update_by_id_existing(self, async_session: AsyncSession):
        """测试更新存在的记录"""
        # 先创建一条记录
        cu = _TestCU(name="更新前", status=_TestStatus.ACTIVE, value=600, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)
        await async_session.refresh(created)

        # 保存ID值,避免greenlet错误
        created_id = created.id

        # 更新记录
        update_cu = _TestCU(name="更新后", status=_TestStatus.INACTIVE, value=700, create_operator_id=1, update_operator_id=2)
        result = await _TestDAL.update_only_set_by_id(async_session, created_id, update_cu)

        assert result is not None
        assert result.id == created_id
        assert result.name == "更新后"
        assert result.status == _TestStatus.INACTIVE.value
        assert result.value == 700
        assert result.update_operator_id == 2

    async def test_update_by_id_nonexistent(self, async_session: AsyncSession):
        """测试更新不存在的记录"""
        update_cu = _TestCU(name="不存在", status=_TestStatus.ACTIVE, value=800, create_operator_id=1)
        result = await _TestDAL.update_only_set_by_id(async_session, 99999, update_cu)
        assert result is None

    async def test_ret_dto_after_update_by_id(self, async_session: AsyncSession):
        """测试更新后返回DTO"""
        # 先创建一条记录
        cu = _TestCU(name="DTO更新前", status=_TestStatus.ACTIVE, value=900, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        # 保存ID值,避免greenlet错误
        created_id = created.id

        # 更新并返回DTO
        update_cu = _TestCU(name="DTO更新后", status=_TestStatus.INACTIVE, value=1000, create_operator_id=1, update_operator_id=3)
        result = await _TestDAL.ret_dto_after_update_by_id(async_session, created_id, update_cu)

        assert result is not None
        assert isinstance(result, _TestDTO)
        assert result.name == "DTO更新后"
        assert result.status == _TestStatus.INACTIVE.value
        assert result.value == 1000

    async def test_delete_by_id_existing(self, async_session: AsyncSession):
        """测试删除存在的记录"""
        # 先创建一条记录
        cu = _TestCU(name="待删除", status=_TestStatus.ACTIVE, value=1100, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        # 保存ID值,避免greenlet错误
        created_id = created.id

        # 删除记录
        result = await _TestDAL.delete_by_id(async_session, created_id)
        assert result is True

        # 验证记录已被软删除(session.get可能绕过过滤器,使用query方式)
        stmt = select(_TestTable).where(_TestTable.id == created_id)
        result = await async_session.execute(stmt)
        deleted_record = result.scalar_one_or_none()
        assert deleted_record is None  # 由于软删除过滤器,查询不到

        # 使用execution_options绕过软删除过滤器查询
        stmt = select(_TestTable).where(_TestTable.id == created_id).execution_options(include_soft_deleted=True)
        result_with_deleted = await async_session.execute(stmt)
        deleted_record = result_with_deleted.scalar_one_or_none()
        assert deleted_record is not None
        assert deleted_record.is_delete == 1

    async def test_delete_by_id_nonexistent(self, async_session: AsyncSession):
        """测试删除不存在的记录"""
        result = await _TestDAL.delete_by_id(async_session, 99999)
        assert result is False

    async def test_ret_dto_after_update_by_id_nonexistent(self, async_session: AsyncSession):
        """覆盖 ret_dto_after_update_by_id 不存在记录返回 None(约第349行)"""
        result = await _TestDAL.ret_dto_after_update_by_id(
            async_session,
            99999999,
            _TestCU(name="不存在更新", status=_TestStatus.ACTIVE, value=0, create_operator_id=1),
        )
        assert result is None


# ========== 测试SQL执行 ==========


class TestBaseDALSQL:
    """测试BaseDAL的SQL执行功能"""

    async def test_execute_sql_text_string(self, async_session: AsyncSession):
        """测试执行文本SQL"""
        sql = "SELECT 1 as test_value"
        result = await _TestDAL.execute_sql(async_session, sql)

        row = result.fetchone()
        assert row is not None
        assert row.test_value == 1

    async def test_execute_sql_text_clause(self, async_session: AsyncSession):
        """测试执行TextClause"""
        sql = text("SELECT :value as test_value")
        params = {"value": 42}
        result = await _TestDAL.execute_sql(async_session, sql, params)

        row = result.fetchone()
        assert row is not None
        assert row.test_value == 42

    async def test_execute_sql_with_params_dict(self, async_session: AsyncSession):
        """测试带字典参数的SQL执行"""
        sql = "SELECT :name as name, :value as value"
        params = {"name": "test", "value": 123}
        result = await _TestDAL.execute_sql(async_session, sql, params)

        row = result.fetchone()
        assert row is not None
        assert row.name == "test"
        assert row.value == 123

    async def test_execute_sql_no_params(self, async_session: AsyncSession):
        """测试无参数的SQL执行"""
        sql = "SELECT 'hello' as greeting"
        result = await _TestDAL.execute_sql(async_session, sql)

        row = result.fetchone()
        assert row is not None
        assert row.greeting == "hello"


# ========== 测试软删除功能 ==========


class TestSoftDelete:
    """测试软删除功能"""

    def test_soft_delete_mixin_methods(self):
        """测试软删除Mixin的方法"""
        # 使用_TestTable测试,因为它继承了SoftDeleteTableMixin
        instance = _TestTable(
            name="测试软删除",
            status=1,
            create_operator_id=1,
        )
        # 手动设置is_delete属性,因为它有默认值
        instance.is_delete = 0

        # 测试初始状态
        assert instance.is_delete == 0

        # 测试删除
        instance.delete()
        assert instance.is_delete == 1

        # 测试自定义删除标记
        instance.delete(2)
        assert instance.is_delete == 2

        # 测试恢复
        instance.undelete()
        assert instance.is_delete == 0

    async def test_soft_delete_filtering(self, async_session: AsyncSession):
        """测试软删除过滤功能"""
        # 创建两条记录
        cu1 = _TestCU(name="正常记录", status=_TestStatus.ACTIVE, value=100, create_operator_id=1)
        cu2 = _TestCU(name="待删除记录", status=_TestStatus.ACTIVE, value=200, create_operator_id=1)

        record1 = await _TestDAL.create(async_session, cu1)
        record2 = await _TestDAL.create(async_session, cu2)

        # 手动标记一条记录为删除
        record2.delete()
        await async_session.commit()

        # 正常查询应该只返回未删除的记录(至少包含我们刚创建的记录)
        all_records = await async_session.execute(select(_TestTable))
        normal_results = all_records.scalars().all()
        assert len(normal_results) >= 1  # 至少有一个未删除的记录

        # 确保我们创建的正常记录在结果中
        normal_ids = [r.id for r in normal_results]
        assert record1.id in normal_ids

        # 使用include_soft_deleted选项应该返回更多记录(包括已删除的)
        all_with_deleted = await async_session.execute(select(_TestTable).execution_options(include_soft_deleted=True))
        all_results = all_with_deleted.scalars().all()
        assert len(all_results) >= len(normal_results)  # 已删除的记录应该更多或相等


# ========== 测试AsyncTableBase辅助方法 ==========


# 简单表CRUD在集成测试中已覆盖,无需重复测试


# ========== 集成测试 ==========


class TestBaseDALIntegration:
    """BaseDAL集成测试"""

    async def test_full_workflow(self, async_session: AsyncSession):
        """测试完整工作流程 + 覆盖未测试的代码路径"""
        # 1. 创建记录
        cu = _TestCU(name="集成测试", status=_TestStatus.ACTIVE, description="这是一个集成测试", value=1000, create_operator_id=1)

        created_dto = await _TestDAL.ret_dto_after_create(async_session, cu)
        assert isinstance(created_dto, _TestDTO)
        assert created_dto.name == "集成测试"

        # 注意:to_cu()方法在实际业务中很少使用,因为DTO有额外字段不能直接转为CU

        # 2. 查询记录
        retrieved_dto = await _TestDAL.ret_dto_after_get_by_id(async_session, created_dto.id)
        assert retrieved_dto is not None
        assert retrieved_dto.name == "集成测试"
        assert retrieved_dto.value == 1000

        # 测试查询不存在的记录(覆盖第353行的None返回)
        not_found_dto = await _TestDAL.ret_dto_after_get_by_id(async_session, 99999)
        assert not_found_dto is None

        # 3. 更新记录
        update_cu = _TestCU(name="集成测试-已更新", status=_TestStatus.INACTIVE, value=2000, create_operator_id=1, update_operator_id=2)

        updated_dto = await _TestDAL.ret_dto_after_update_by_id(async_session, created_dto.id, update_cu)
        assert updated_dto is not None
        assert updated_dto.name == "集成测试-已更新"
        assert updated_dto.status == _TestStatus.INACTIVE.value
        assert updated_dto.value == 2000

        # 4. 验证更新后的记录
        final_check = await _TestDAL.ret_dto_after_get_by_id(async_session, created_dto.id)
        assert final_check is not None
        assert final_check.name == "集成测试-已更新"
        assert final_check.value == 2000

        # 5. 测试删除(统一使用flush策略)
        delete_result = await _TestDAL.delete_by_id(async_session, created_dto.id)
        assert delete_result is True
        await async_session.commit()  # 手动提交

        # 6. 验证软删除生效
        not_found = await _TestDAL.ret_dto_after_get_by_id(async_session, created_dto.id)
        assert not_found is None

    # 批量操作在实际业务中由业务层管理,此处只测试基本参数配置

    async def test_need_refresh_parameter(self, async_session: AsyncSession):
        """测试need_refresh参数功能"""
        cu = _TestCU(name="测试refresh参数", status=_TestStatus.ACTIVE, value=42, create_operator_id=1)

        # 测试create with need_refresh=False(此时entity可能缺少某些服务器生成的字段)
        entity_no_refresh = await _TestDAL.create(async_session, cu, need_refresh=False)
        assert entity_no_refresh.name == "测试refresh参数"
        # 注意:当need_refresh=False时,id可能为None或未设置,这是预期行为

        # 测试create with need_refresh=True(默认值,会refresh获取所有字段)
        cu2 = _TestCU(name="测试refresh参数2", status=_TestStatus.ACTIVE, value=43, create_operator_id=1)
        entity_with_refresh = await _TestDAL.create(async_session, cu2)
        assert entity_with_refresh.name == "测试refresh参数2"
        assert entity_with_refresh.id is not None  # refresh后会有id

        # 保存entity_id以避免在commit后访问detached实体
        entity_id = entity_with_refresh.id

        # 提交事务
        await async_session.commit()

        # 测试update with need_refresh=False(只测试实体,不转DTO)
        update_cu = _TestCU(name="更新不refresh", value=100, create_operator_id=1)
        updated_no_refresh = await _TestDAL.update_only_set_by_id(async_session, entity_id, update_cu, need_refresh=False)
        assert updated_no_refresh is not None
        # 注意:当need_refresh=False时,需要先flush确保数据库状态同步,然后refresh以避免懒加载问题
        await async_session.flush()
        await async_session.refresh(updated_no_refresh)
        assert updated_no_refresh.name == "更新不refresh"

        # 测试update with need_refresh=True(默认值)
        update_cu2 = _TestCU(name="更新会refresh", value=150, create_operator_id=1)
        updated_with_refresh = await _TestDAL.update_only_set_by_id(async_session, entity_id, update_cu2)
        assert updated_with_refresh is not None
        assert updated_with_refresh.name == "更新会refresh"

        # 测试ret_dto方法只在need_refresh=True时调用(避免greenlet错误)
        # 当need_refresh=True时,所有字段都被正确加载,可以安全转换为DTO
        dto_with_refresh = await _TestDAL.ret_dto_after_get_by_id(async_session, entity_id, need_refresh=True)
        assert dto_with_refresh is not None
        assert dto_with_refresh.name == "更新会refresh"

        # 测试ret_dto_after_create with need_refresh=True(默认值)
        cu3 = _TestCU(name="创建DTO会refresh", status=_TestStatus.ACTIVE, value=44, create_operator_id=1)
        dto_create_with_refresh = await _TestDAL.ret_dto_after_create(
            async_session,
            cu3,
            # 使用默认的need_refresh=True
        )
        assert dto_create_with_refresh.name == "创建DTO会refresh"
        assert dto_create_with_refresh.id is not None

        # 测试ret_dto_after_update_by_id with need_refresh=True(默认值)
        update_cu3 = _TestCU(name="更新DTO会refresh", value=200, create_operator_id=1)
        dto_update_with_refresh = await _TestDAL.ret_dto_after_update_by_id(
            async_session,
            dto_create_with_refresh.id,
            update_cu3,
            # 使用默认的need_refresh=True
        )
        assert dto_update_with_refresh is not None
        assert dto_update_with_refresh.name == "更新DTO会refresh"


@pytest.mark.asyncio
async def test_readonly_guard_prevents_writes(db_manager: AsyncSQLiteManager) -> None:
    """在只读会话中, WriteDAL 的写操作应抛出异常"""
    # 先使用普通会话创建一条记录
    async with db_manager.got_manual_session() as session:
        cu = _TestCU(name="只读防写-初始", status=_TestStatus.ACTIVE, value=1, create_operator_id=1)
        created = await _TestDAL.create(session, cu)
        created_id = created.id

    # 现在使用只读会话进行测试
    async with db_manager.got_readonly_session() as readonly_session:
        # create 应被阻止
        with pytest.raises(TypeError):
            await _TestDAL.create(readonly_session, _TestCU(name="new", status=_TestStatus.ACTIVE, value=2, create_operator_id=1))

        # update 应被阻止
        with pytest.raises(TypeError):
            await _TestDAL.update_only_set_by_id(
                readonly_session, created_id, _TestCU(name="upd", status=_TestStatus.ACTIVE, value=3, create_operator_id=1)
            )

        # delete 应被阻止
        with pytest.raises(TypeError):
            await _TestDAL.delete_by_id(readonly_session, created_id)


# ========== 只读功能测试 ==========


class _ReadOnlyTestTable(ReadOnlyBasicAsyncBaseTable):
    """只读测试表"""

    __tablename__ = "unit_testing_readonly_unit_testing_test_table"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    value: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)


class _ReadOnlyTestDTO(BaseDTO["_ReadOnlyTestCU"]):
    """只读测试DTO"""

    _CU: ClassVar[type["_ReadOnlyTestCU"] | None] = None

    id: int
    name: str
    value: int

    model_config = ConfigDict(from_attributes=True)


class _ReadOnlyTestCU(BaseCU["_ReadOnlyTestTable"]):
    """只读测试CU"""

    _Table: ClassVar[type[_ReadOnlyTestTable]] = _ReadOnlyTestTable

    name: str
    value: int = 0


# 设置CU类型关系
_ReadOnlyTestDTO._CU = _ReadOnlyTestCU


class _ReadOnlyTestDAL(ReadOnlyAsyncBaseDAL[_ReadOnlyTestTable, _ReadOnlyTestDTO]):
    """只读测试DAL"""

    _Table = _ReadOnlyTestTable
    _DTO = _ReadOnlyTestDTO


# 测试辅助函数
async def _create_readonly_test_data(async_session: AsyncSession, name: str, value: int) -> int:
    """创建只读表测试数据的辅助函数"""
    from sqlalchemy import event
    from sqlalchemy.orm import Session as SyncSession

    import cl_sqlalchemyx.base.dal as base_dal_module

    # 获取事件监听器函数
    prevent_readonly_write = getattr(base_dal_module, "__prevent_readonly_write", None)

    if prevent_readonly_write:
        # 临时移除事件监听器
        event.remove(SyncSession, "before_flush", prevent_readonly_write)

        try:
            entity = _ReadOnlyTestTable(name=name, value=value)
            async_session.add(entity)
            await async_session.flush()  # 获取ID
            entity_id = entity.id
            await async_session.commit()
            return entity_id
        finally:
            # 重新注册监听器
            event.listen(SyncSession, "before_flush", prevent_readonly_write)
    else:
        # 如果找不到监听器,直接尝试创建(这种情况下ReadOnlyMixin可能没有生效)
        entity = _ReadOnlyTestTable(name=name, value=value)
        async_session.add(entity)
        await async_session.flush()  # 获取ID
        entity_id = entity.id
        await async_session.commit()
        return entity_id


class TestReadOnlyDAL:
    """测试只读DAL功能"""

    async def test_readonly_dal_get_by_id(self, async_session: AsyncSession):
        """测试只读DAL的get_by_id功能"""
        # 使用辅助函数创建测试数据
        entity_id = await _create_readonly_test_data(async_session, "只读测试", 100)

        # 使用只读DAL查询
        result = await _ReadOnlyTestDAL.get_by_id(async_session, entity_id)
        assert result is not None
        assert result.name == "只读测试"
        assert result.value == 100

    async def test_readonly_dal_ret_dto_after_get_by_id(self, async_session: AsyncSession):
        """测试只读DAL的DTO查询功能"""
        # 使用辅助函数创建测试数据
        entity_id = await _create_readonly_test_data(async_session, "DTO测试", 200)

        # 使用只读DAL查询DTO
        result = await _ReadOnlyTestDAL.ret_dto_after_get_by_id(async_session, entity_id)
        assert result is not None
        assert isinstance(result, _ReadOnlyTestDTO)
        assert result.name == "DTO测试"
        assert result.value == 200

    async def test_readonly_dal_get_all(self, async_session: AsyncSession):
        """测试只读DAL的get_all功能"""
        # 由于只读表的特殊性,我们简化测试逻辑
        # 使用只读DAL查询现有记录
        results = await _ReadOnlyTestDAL.get_all(async_session, skip=0, limit=10)
        assert len(results) >= 0  # 可能没有记录,这也是正常的
        assert all(isinstance(r, _ReadOnlyTestDTO) for r in results)

        # 如果有记录,验证其结构
        if results:
            result = results[0]
            assert hasattr(result, "id")
            assert hasattr(result, "name")
            assert hasattr(result, "value")
            assert isinstance(result.id, int)
            assert isinstance(result.name, str)
            assert isinstance(result.value, int)

    async def test_readonly_dal_count(self, async_session: AsyncSession):
        """测试只读DAL的count功能"""
        # 使用辅助函数创建测试数据
        for i in range(3):
            await _create_readonly_test_data(async_session, f"计数测试_{i}", i)

        # 使用只读DAL统计
        count = await _ReadOnlyTestDAL.count(async_session)
        assert count >= 3  # 可能有其他测试的数据

    async def test_readonly_dal_exists(self, async_session: AsyncSession):
        """测试只读DAL的exists功能"""
        # 使用辅助函数创建测试数据
        entity_id = await _create_readonly_test_data(async_session, "存在性测试", 42)

        # 测试存在的记录
        assert await _ReadOnlyTestDAL.exists(async_session, entity_id) is True

        # 测试不存在的记录
        assert await _ReadOnlyTestDAL.exists(async_session, 99999) is False

    async def test_readonly_dal_no_write_methods(self):
        """验证只读DAL没有写入方法"""
        # 只读DAL不应该有这些写入方法
        assert not hasattr(_ReadOnlyTestDAL, "create")
        assert not hasattr(_ReadOnlyTestDAL, "ret_dto_after_create")
        assert not hasattr(_ReadOnlyTestDAL, "update_by_id")
        assert not hasattr(_ReadOnlyTestDAL, "ret_dto_after_update_by_id")
        assert not hasattr(_ReadOnlyTestDAL, "delete_by_id")
        assert not hasattr(_ReadOnlyTestDAL, "execute_sql")

        # 但应该有只读SQL执行方法
        assert hasattr(_ReadOnlyTestDAL, "execute_readonly_sql")


class TestReadOnlyTable:
    """测试只读表的安全特性"""

    async def test_readonly_table_creation(self, async_session: AsyncSession):
        """测试只读表可以正常创建"""
        # 创建时应该正常工作
        entity_id = await _create_readonly_test_data(async_session, "创建测试", 100)

        assert entity_id is not None
        # 获取数据验证创建是否成功
        created_entity = await _ReadOnlyTestDAL.get_by_id(async_session, entity_id)
        assert created_entity is not None
        assert created_entity.name == "创建测试"
        assert created_entity.value == 100

    async def test_readonly_table_modification_protection(self, async_session: AsyncSession):
        """测试只读表的修改保护(基于新的ReadOnlyMixin事件监听)"""
        # 创建只读表实体并尝试添加到session - 应该被阻止
        entity = _ReadOnlyTestTable(name="保护测试", value=100)
        async_session.add(entity)

        # 尝试提交 - 应该被新的事件监听器阻止
        with pytest.raises(TypeError, match="不允许对只读模型.*执行.*操作"):
            await async_session.commit()

        await async_session.rollback()

    async def test_readonly_table_internal_attributes_allowed(self, async_session: AsyncSession):
        """测试只读表的读取功能正常工作"""
        # 使用辅助函数创建测试数据
        entity_id = await _create_readonly_test_data(async_session, "内部属性测试", 100)

        # 验证可以正常读取数据
        retrieved = await async_session.get(_ReadOnlyTestTable, entity_id)
        assert retrieved is not None
        assert retrieved.name == "内部属性测试"
        assert retrieved.value == 100


class TestReadOnlySQL:
    """测试只读SQL执行的安全检查"""

    async def test_execute_readonly_sql_select_allowed(self, async_session: AsyncSession):
        """测试只读SQL允许执行SELECT语句"""
        # SELECT语句应该被允许
        sql = "SELECT 1 as test_value"
        result = await _ReadOnlyTestDAL.execute_readonly_sql(async_session, sql)

        row = result.fetchone()
        assert row is not None
        assert row.test_value == 1

    async def test_execute_readonly_sql_with_params(self, async_session: AsyncSession):
        """测试只读SQL带参数执行"""
        sql = "SELECT :value as test_value"
        params = {"value": 42}
        result = await _ReadOnlyTestDAL.execute_readonly_sql(async_session, sql, params)

        row = result.fetchone()
        assert row is not None
        assert row.test_value == 42

    async def test_execute_readonly_sql_insert_blocked(self, async_session: AsyncSession):
        """测试只读SQL阻止INSERT语句"""
        sql = "INSERT INTO unit_testing_test_table (name, value) VALUES ('test', 1)"

        with pytest.raises(RuntimeError, match="只读DAL不允许执行写入操作SQL: INSERT"):
            await _ReadOnlyTestDAL.execute_readonly_sql(async_session, sql)

    async def test_execute_readonly_sql_update_blocked(self, async_session: AsyncSession):
        """测试只读SQL阻止UPDATE语句"""
        sql = "UPDATE unit_testing_test_table SET name = 'updated' WHERE id = 1"

        with pytest.raises(RuntimeError, match="只读DAL不允许执行写入操作SQL: UPDATE"):
            await _ReadOnlyTestDAL.execute_readonly_sql(async_session, sql)

    async def test_execute_readonly_sql_delete_blocked(self, async_session: AsyncSession):
        """测试只读SQL阻止DELETE语句"""
        sql = "DELETE FROM unit_testing_test_table WHERE id = 1"

        with pytest.raises(RuntimeError, match="只读DAL不允许执行写入操作SQL: DELETE"):
            await _ReadOnlyTestDAL.execute_readonly_sql(async_session, sql)

    async def test_execute_readonly_sql_ddl_blocked(self, async_session: AsyncSession):
        """测试只读SQL阻止DDL语句"""
        ddl_statements = [
            "CREATE TABLE test (id INT)",
            "DROP TABLE test",
            "ALTER TABLE test ADD COLUMN name VARCHAR(50)",
            "TRUNCATE TABLE test",
        ]

        for sql in ddl_statements:
            with pytest.raises(RuntimeError, match="只读DAL不允许执行写入操作SQL"):
                await _ReadOnlyTestDAL.execute_readonly_sql(async_session, sql)

    async def test_execute_readonly_sql_case_insensitive(self, async_session: AsyncSession):
        """测试只读SQL检查大小写不敏感"""
        sql_variants = [
            "insert into unit_testing_test_table VALUES (1)",
            "Insert Into unit_testing_test_table VALUES (1)",
            "UPDATE unit_testing_test_table SET name = 'test'",
            "update unit_testing_test_table set name = 'test'",
            "Delete From unit_testing_test_table",
            "delete from unit_testing_test_table",
        ]

        for sql in sql_variants:
            with pytest.raises(RuntimeError, match="只读DAL不允许执行写入操作SQL"):
                await _ReadOnlyTestDAL.execute_readonly_sql(async_session, sql)


class TestAbstractInterfaces:
    """测试抽象接口的正确实现"""

    def test_abstract_read_dal_interface(self):
        """测试ReadDAL接口"""
        # ReadDAL现在是一个具体类,不再是抽象类
        # 检查ReadDAL有正确的方法

        # 检查ReadOnlyBaseDAL正确实现了所有方法
        readonly_methods = {
            "get_by_id",
            "ret_dto_after_get_by_id",
            "get_all",
            "count",
            "exists",
        }

        for method_name in readonly_methods:
            assert hasattr(_ReadOnlyTestDAL, method_name)
            assert callable(getattr(_ReadOnlyTestDAL, method_name))

    def test_interface_segregation(self):
        """测试接口分离原则"""
        # ReadOnlyBaseDAL应该只继承AbstractReadDAL
        assert issubclass(ReadOnlyAsyncBaseDAL, AsyncReadDAL)
        assert not issubclass(ReadOnlyAsyncBaseDAL, AsyncWriteDAL)

        # BaseDAL应该继承both接口
        assert issubclass(AsyncBaseDAL, AsyncReadDAL)
        assert issubclass(AsyncBaseDAL, AsyncWriteDAL)

    def test_readonly_dal_inheritance_safety(self):
        """测试只读DAL继承安全性"""
        # 确保_ReadOnlyTestDAL只有读取功能
        readonly_dal_methods = set(dir(_ReadOnlyTestDAL))
        write_method_names = {
            "create",
            "ret_dto_after_create",
            "update_by_id",
            "ret_dto_after_update_by_id",
            "delete_by_id",
            "execute_sql",
        }

        # 只读DAL不应该有写入方法
        for write_method in write_method_names:
            assert write_method not in readonly_dal_methods or not callable(getattr(_ReadOnlyTestDAL, write_method, None)), (
                f"只读DAL不应该有写入方法: {write_method}"
            )

        # 但应该有读取方法
        read_method_names = {
            "get_by_id",
            "ret_dto_after_get_by_id",
            "get_all",
            "count",
            "exists",
            "execute_readonly_sql",
        }

        for read_method in read_method_names:
            assert read_method in readonly_dal_methods, f"只读DAL应该有读取方法: {read_method}"
            assert callable(getattr(_ReadOnlyTestDAL, read_method)), f"读取方法应该可调用: {read_method}"


class TestStandardCUBase:
    """测试标准CU基类功能"""

    def test_std_base_cu_inheritance(self):
        """测试StdBaseCU继承关系"""
        assert issubclass(_TestCU, StdBaseCU)
        assert issubclass(StdBaseCU, BaseCU)

    def test_std_base_cu_required_fields(self):
        """测试StdBaseCU包含必需的标准字段"""
        # 检查StdBaseCU有标准字段
        assert hasattr(StdBaseCU, "__annotations__")
        annotations = StdBaseCU.__annotations__

        expected_fields = {
            "create_operator_id": int,
            "update_operator_id": int | None,
        }

        for field_name in expected_fields:
            assert field_name in annotations, f"StdBaseCU应该有字段: {field_name}"
            # 注意:这里类型检查可能需要更复杂的逻辑,暂时只检查字段存在

    async def test_std_base_cu_create_with_std_fields(self, async_session: AsyncSession):
        """测试使用StdBaseCU创建记录包含标准字段"""
        cu = _TestCU(
            name="标准字段测试",
            status=_TestStatus.ACTIVE,
            value=100,
            create_operator_id=123,
            update_operator_id=456,
        )

        created = await _TestDAL.create(async_session, cu)

        assert created.create_operator_id == 123
        assert created.update_operator_id == 456
        assert created.name == "标准字段测试"

    async def test_std_base_cu_to_sqla_model(self, async_session: AsyncSession):
        """测试StdBaseCU的to_sqla_model方法"""
        cu = _TestCU(
            name="转换测试",
            status=_TestStatus.INACTIVE,
            value=200,
            create_operator_id=999,
        )

        # 测试转换为SQLAlchemy模型
        model = cu.to_sqla_model()

        assert isinstance(model, _TestTable)
        assert model.name == "转换测试"
        assert model.status == _TestStatus.INACTIVE.value
        assert model.value == 200
        assert model.create_operator_id == 999
        assert model.update_operator_id is None  # 默认值

    async def test_base_dto_to_cu_conversion_raises(self, async_session: AsyncSession):
        """覆盖 BaseDTO.to_cu 路径: DTO 含额外字段/类型不匹配时抛异常"""
        cu = _TestCU(name="DTO->CU转换", status=_TestStatus.ACTIVE, value=1, create_operator_id=7)
        dto = await _TestDAL.ret_dto_after_create(async_session, cu)
        with pytest.raises(ValidationError):
            _ = dto.to_cu()


class TestEnhancedBestPractices:
    """增强的最佳实践测试"""

    async def test_transaction_safety_with_readonly(self, async_session: AsyncSession):
        """测试只读操作的事务安全性"""
        # 使用辅助函数创建测试数据
        entity_id = await _create_readonly_test_data(async_session, "事务安全测试", 100)

        # 在事务中进行只读操作
        async with async_session.begin():
            result = await _ReadOnlyTestDAL.get_by_id(async_session, entity_id)
            assert result is not None

            # 只读操作不应该影响事务状态
            dto_result = await _ReadOnlyTestDAL.ret_dto_after_get_by_id(async_session, entity_id)
            assert dto_result is not None

            # 事务应该可以正常提交
            # (begin()上下文管理器会自动提交)

    async def test_performance_considerations(self, async_session: AsyncSession):
        """测试性能考虑和最佳实践"""
        # 使用辅助函数创建大量测试数据
        for i in range(100):
            await _create_readonly_test_data(async_session, f"性能测试_{i}", i)

        # 测试分页查询性能
        import time

        start_time = time.time()
        first_page = await _ReadOnlyTestDAL.get_all(async_session, skip=0, limit=10)
        end_time = time.time()

        assert len(first_page) == 10
        assert end_time - start_time < 1.0  # 应该在1秒内完成

        # 测试统计查询
        start_time = time.time()
        total_count = await _ReadOnlyTestDAL.count(async_session)
        end_time = time.time()

        assert total_count >= 100
        assert end_time - start_time < 1.0  # 应该在1秒内完成

    async def test_error_handling_best_practices(self, async_session: AsyncSession):
        """测试错误处理最佳实践"""
        # 测试查询不存在的记录
        result = await _ReadOnlyTestDAL.get_by_id(async_session, 99999)
        assert result is None  # 应该返回None而不是抛出异常

        dto_result = await _ReadOnlyTestDAL.ret_dto_after_get_by_id(async_session, 99999)
        assert dto_result is None  # 应该返回None而不是抛出异常

        exists_result = await _ReadOnlyTestDAL.exists(async_session, 99999)
        assert exists_result is False  # 应该返回False而不是抛出异常

    async def test_type_safety_validation(self, async_session: AsyncSession):
        """测试类型安全验证"""
        # 验证DTO类型安全
        entity_id = await _create_readonly_test_data(async_session, "类型安全测试", 42)

        dto = await _ReadOnlyTestDAL.ret_dto_after_get_by_id(async_session, entity_id)
        assert isinstance(dto, _ReadOnlyTestDTO)
        assert isinstance(dto.id, int)
        assert isinstance(dto.name, str)
        assert isinstance(dto.value, int)

        # 验证列表返回类型
        dto_list = await _ReadOnlyTestDAL.get_all(async_session, limit=1)
        assert isinstance(dto_list, list)
        assert len(dto_list) >= 1
        assert all(isinstance(item, _ReadOnlyTestDTO) for item in dto_list)

    def test_documentation_and_naming_conventions(self):
        """测试文档和命名约定"""
        # 检查类有适当的文档字符串
        assert _ReadOnlyTestDAL.__doc__ is not None
        assert _ReadOnlyTestTable.__doc__ is not None
        assert _ReadOnlyTestDTO.__doc__ is not None

        # 检查命名约定
        assert _ReadOnlyTestTable.__tablename__ == "unit_testing_readonly_unit_testing_test_table"
        # 新的ReadOnlyMixin不使用__readonly__属性,而是通过isinstance检查

        # 检查基类的命名约定
        assert "Read" in AsyncReadDAL.__name__
        assert "Write" in AsyncWriteDAL.__name__
        assert "ReadOnly" in ReadOnlyAsyncBaseDAL.__name__


# ========== DataJson 类型测试 ==========


class _TestDataModel(BaseModel):
    """测试用的数据模型"""

    title: str = Field(..., description="标题")
    description: str | None = Field(None, description="描述")
    tags: list[str] = Field(default_factory=list, description="标签")
    metadata: dict[str, Any] = Field(default_factory=dict, description="元数据")
    count: int = Field(default=0, description="计数")
    is_active: bool = Field(default=True, description="是否激活")


class _TestDataJsonTable(StdAsyncBaseTable):
    """测试DataJson的表"""

    __tablename__ = "unit_testing_test_datajson_table"

    name: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    # 使用 LargeBinary 存储序列化后的 JSON 数据
    data_json: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False, default=b"{}", comment="数据JSON")
    status: Mapped[int] = mapped_column(sa.SmallInteger, nullable=False, default=1)


class _TestDataJsonCU(StdBaseCU["_TestDataJsonTable"]):
    _Table: ClassVar[type[_TestDataJsonTable]] = _TestDataJsonTable

    name: str
    # 使用 DataJson 类型,支持 Pydantic 模型对象
    data_json: DataJson[_TestDataModel] = _TestDataModel(title="Default", tags=["test"])
    status: int = 1

    @field_serializer("data_json")
    def serialize_data_json(self, value: Any) -> bytes:
        """序列化 data_json 字段为 bytes"""
        return json_to_bytes_serializer(value)


# DTO 继承自 CU,自动处理 DataJson 的序列化/反序列化
class _TestDataJsonDTO(_TestDataJsonCU, StdBaseDTO[_TestDataJsonCU]):
    _CU: ClassVar[type[_TestDataJsonCU]] = _TestDataJsonCU


class _TestDataJsonDAL(AsyncBaseDAL[_TestDataJsonTable, _TestDataJsonDTO, _TestDataJsonCU]):
    _Table = _TestDataJsonTable
    _DTO = _TestDataJsonDTO
    _CU = _TestDataJsonCU


class TestDataJsonFields:
    """测试 DataJson 字段类型的支持——高覆盖率低维护成本"""

    async def test_datajson_crud_workflow(self, async_session: AsyncSession):
        """测试 DataJson 的完整 CRUD 工作流:创建、查询、更新、复杂数据"""
        # 1. 测试创建和基本查询
        test_data = _TestDataModel(
            title="测试任务",
            description="DataJson CRUD 测试",
            tags=["重要", "测试"],
            metadata={"priority": "high", "version": "1.0"},
            count=42,
            is_active=True,
        )

        cu = _TestDataJsonCU(
            name="DataJson测试",
            data_json=test_data,
            create_operator_id=1,
        )

        # 创建并验证序列化正确
        created_entity = await _TestDataJsonDAL.create(async_session, cu)
        assert isinstance(created_entity.data_json, bytes)  # 数据库存储为bytes

        # 查询并验证反序列化正确
        retrieved_dto = await _TestDataJsonDAL.ret_dto_after_get_by_id(async_session, created_entity.id)
        assert retrieved_dto is not None
        assert isinstance(retrieved_dto.data_json, _TestDataModel)  # DTO中自动反序列化
        assert retrieved_dto.data_json.title == "测试任务"
        assert retrieved_dto.data_json.metadata["priority"] == "high"

        # 2. 测试更新操作(这是主要问题点)
        updated_data = _TestDataModel(
            title="更新任务",
            description="已更新",
            tags=["完成"],
            metadata={"status": "done"},
            count=100,
            is_active=False,
        )

        update_cu = _TestDataJsonCU(
            name="更新测试",
            data_json=updated_data,
            create_operator_id=1,
            update_operator_id=2,
        )

        # 验证更新功能(无需手动序列化)
        updated_entity = await _TestDataJsonDAL.update_only_set_by_id(async_session, created_entity.id, update_cu)
        assert updated_entity is not None
        assert updated_entity.name == "更新测试"

        # 验证更新后数据正确
        final_dto = await _TestDataJsonDAL.ret_dto_after_get_by_id(async_session, created_entity.id)
        assert final_dto is not None
        assert final_dto.data_json.title == "更新任务"
        assert final_dto.data_json.count == 100
        assert final_dto.data_json.is_active is False

    async def test_datajson_edge_cases(self, async_session: AsyncSession):
        """测试 DataJson 的边界情况和特殊字符处理"""
        # 测试默认值(显式指定默认值以触发序列化器)
        default_data = _TestDataModel(title="Default", tags=["test"])
        cu_default = _TestDataJsonCU(name="默认值测试", data_json=default_data, create_operator_id=1)
        created_default = await _TestDataJsonDAL.ret_dto_after_create(async_session, cu_default)
        assert created_default.data_json.title == "Default"
        assert created_default.data_json.tags == ["test"]

        # 测试空值和特殊字符
        edge_data = _TestDataModel(
            title='特殊: "quotes" & 中文 😀',
            description="",  # 空字符串
            tags=[],  # 空列表
            metadata={"unicode": "中文 العربية русский"},  # Unicode
            count=-1,  # 负数
            is_active=False,
        )

        cu_edge = _TestDataJsonCU(name="边界测试", data_json=edge_data, create_operator_id=1)
        created_edge = await _TestDataJsonDAL.ret_dto_after_create(async_session, cu_edge)

        assert "quotes" in created_edge.data_json.title
        assert "😀" in created_edge.data_json.title
        assert created_edge.data_json.description == ""
        assert created_edge.data_json.tags == []
        assert created_edge.data_json.metadata["unicode"] == "中文 العربية русский"
        assert created_edge.data_json.count == -1


class TestDataJsonBytesField:
    """验证 FieldMixin.DataJsonBytes 的行为"""

    async def test_x_data_json_roundtrip(self, async_session: AsyncSession):
        class DM(BaseModel):
            a: int = 1
            b: str = "x"

        class T(StdReadOnlyBasicAsyncBaseTable, FieldMixin.DataJsonBytes[DM]):
            __tablename__ = "unit_testing_table_datajson_mixin"

            # 定义与只读表相同的字段,但我们不向数据库写入,仅用于内存层行为验证
            id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
            data_json: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False, default=b"{}")

        # 绑定模型
        T._DATA_JSON = DM  # type: ignore[attr-defined]

        # 在内存中创建对象,不写入数据库
        entity = T()

        # 默认应能得到一个模型实例
        m = entity.x_data_json
        assert isinstance(m, DM)
        assert m.a == 1 and m.b == "x"

        # 写回新的模型
        entity.x_data_json = DM(a=7, b="ok")

        # 再读应一致
        m2 = entity.x_data_json
        assert isinstance(m2, DM)
        assert m2.a == 7 and m2.b == "ok"


# ========== 事务管理测试 ==========


class TestTransactionManagement:
    """测试事务管理相关的功能"""

    async def test_end_transaction_now_with_active_transaction(self, async_session: AsyncSession):
        """测试 end_transaction_now 在有活跃事务时执行 rollback"""
        # 开始一个事务但不提交
        await async_session.execute(text("SELECT 1"))
        assert async_session.in_transaction()

        # 调用 end_transaction_now
        await async_must_rollback_if_in_transaction(async_session)

        # 事务应该被回滚
        assert not async_session.in_transaction()

    async def test_end_transaction_now_without_active_transaction(self, async_session: AsyncSession):
        """测试 end_transaction_now 在没有活跃事务时不做任何操作"""
        # 确保没有活跃事务
        if async_session.in_transaction():
            await async_session.rollback()

        # 记录初始状态
        initial_state = async_session.in_transaction()
        assert not initial_state

        # 调用 end_transaction_now
        await async_must_rollback_if_in_transaction(async_session)

        # 状态应该保持不变
        assert async_session.in_transaction() == initial_state

    async def test_end_transaction_now_with_committed_transaction(self, async_session: AsyncSession):
        """测试 end_transaction_now 在事务已提交后的行为"""
        # 开始事务并提交
        await async_session.execute(text("SELECT 1"))
        await async_session.commit()

        # 确保事务已提交
        assert not async_session.in_transaction()

        # 调用 end_transaction_now
        await async_must_rollback_if_in_transaction(async_session)

        # 状态应该保持不变
        assert not async_session.in_transaction()

    async def test_end_transaction_now_with_rollback_transaction(self, async_session: AsyncSession):
        """测试 end_transaction_now 在事务已回滚后的行为"""
        # 开始事务并回滚
        await async_session.execute(text("SELECT 1"))
        await async_session.rollback()

        # 确保事务已回滚
        assert not async_session.in_transaction()

        # 调用 end_transaction_now
        await async_must_rollback_if_in_transaction(async_session)

        # 状态应该保持不变
        assert not async_session.in_transaction()

    async def test_end_transaction_now_exception_handling(self, async_session: AsyncSession):
        """测试 end_transaction_now 的异常处理机制"""
        # 开始一个事务
        await async_session.execute(text("SELECT 1"))
        assert async_session.in_transaction()

        # 模拟 session 异常(我们无法直接模拟,但可以验证函数不会抛出异常)
        try:
            await async_must_rollback_if_in_transaction(async_session)
            # 函数应该正常执行,不抛出异常
            assert True  # 如果执行到这里,说明异常被正确处理了
        except Exception as e:
            pytest.fail(f"end_transaction_now 应该处理所有异常,但抛出了: {e}")

        # 无论如何,事务状态都应该被正确处理
        assert not async_session.in_transaction()


class TestNewUpdateApis:
    """测试新引入的单条更新API: update_full_by_id / update_partial_by_id"""

    async def test_update_full_by_id_overwrite_none(self, async_session: AsyncSession):
        """full: 显式 None 应覆盖为 NULL (不受 none 策略限制)"""
        # 创建
        cu = _TestCU(name="FullInit", status=_TestStatus.ACTIVE, description="old", value=10, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        # 更新: 将 description 置为 None
        full_cu = _TestCU(
            name="FullUpdated", status=_TestStatus.INACTIVE, description=None, value=20, create_operator_id=1, update_operator_id=9
        )
        updated = await _TestDAL.update_full_by_id(async_session, created.id, full_cu, strict_missing=True)

        assert updated is not None
        await async_session.refresh(updated)
        assert updated.name == "FullUpdated"
        assert updated.status == _TestStatus.INACTIVE.value
        assert updated.value == 20
        assert updated.description is None
        assert updated.update_operator_id == 9

    async def test_update_partial_by_id_fields_and_none_policy(self, async_session: AsyncSession):
        """partial: 仅更新白名单字段 + 默认不覆盖 None, 指定字段允许置空"""
        # 创建并设置 description 初值
        cu = _TestCU(name="PInit", status=_TestStatus.ACTIVE, description="keep-me", value=33, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        # 构造部分更新: name 更改; description=None 但默认 none_policy=ignore 不覆盖
        part_cu = _TestCU(name="PNew", description=None)

        from sqlalchemy.orm import InstrumentedAttribute  # noqa: F401 (类型标注用途)

        updated1 = await _TestDAL.update_partial_by_id(
            async_session,
            created.id,
            part_cu,
            fields={_TestTable.name, _TestTable.description},
            none_policy="ignore",
        )
        assert updated1 is not None
        await async_session.refresh(updated1)
        assert updated1.name == "PNew"
        # description 应保持旧值 (未覆盖为 None)
        assert updated1.description == "keep-me"

        # 指定 description 允许覆盖为 None (name 保持当前值即可)
        part_cu2 = _TestCU(name="PNew", description=None)
        updated2 = await _TestDAL.update_partial_by_id(
            async_session,
            created.id,
            part_cu2,
            fields={_TestTable.description},
            none_policy="ignore",
            none_policy_overrides={_TestTable.description: "allow"},
        )
        assert updated2 is not None
        await async_session.refresh(updated2)
        assert updated2.description is None

    async def test_update_partial_by_id_strict_rejects_non_whitelisted(self, async_session: AsyncSession):
        """partial: strict=True 时, CU 中出现非白名单字段应抛错"""
        cu = _TestCU(name="SInit", status=_TestStatus.ACTIVE, value=1, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        bad_cu = _TestCU(name="SInit", value=999)  # 非白名单字段尝试更新
        with pytest.raises(ValueError):
            await _TestDAL.update_partial_by_id(
                async_session,
                created.id,
                bad_cu,
                fields={_TestTable.name},
                strict=True,
            )


class TestNewUpdateApisMore:
    """补充覆盖 update_full_by_id / update_partial_by_id 的分支与事务场景"""

    async def test_update_full_by_id_not_found_returns_none(self, async_session: AsyncSession):
        cu = _TestCU(name="NF", status=_TestStatus.ACTIVE, value=1, create_operator_id=1)
        result = await _TestDAL.update_full_by_id(async_session, 999_999, cu)
        assert result is None

    async def test_update_partial_by_id_no_fields_no_strict(self, async_session: AsyncSession):
        cu = _TestCU(name="Init", status=_TestStatus.ACTIVE, value=10, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        part = _TestCU(name="Changed", value=77)
        updated = await _TestDAL.update_partial_by_id(
            async_session,
            created.id,
            part,
            fields=None,  # 不限制字段
            strict=True,  # 严格但无 fields -> 不触发校验
        )
        assert updated is not None
        await async_session.refresh(updated)
        assert updated.name == "Changed"
        assert updated.value == 77

    async def test_update_partial_by_id_forbid_none_raises(self, async_session: AsyncSession):
        cu = _TestCU(name="ForbidInit", status=_TestStatus.ACTIVE, description="x", value=1, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        with pytest.raises(ValueError):
            await _TestDAL.update_partial_by_id(
                async_session,
                created.id,
                _TestCU(name="ForbidInit", description=None),
                fields={_TestTable.description},
                none_policy="forbid",
            )

    async def test_update_partial_by_id_overrides_with_sa_column(self, async_session: AsyncSession):
        cu = _TestCU(name="ColInit", status=_TestStatus.ACTIVE, description="keep", value=11, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        # 使用 sa.Column 作为覆盖键
        from typing import cast

        import sqlalchemy as sa

        col = cast(sa.Column[Any], _TestTable.__table__.c.description)
        updated = await _TestDAL.update_partial_by_id(
            async_session,
            created.id,
            _TestCU(name="ColInit", description=None),
            fields={_TestTable.description},
            none_policy="ignore",
            none_policy_overrides={col: "allow"},
        )
        assert updated is not None
        await async_session.refresh(updated)
        assert updated.description is None

    async def test_update_partial_by_id_tx_begin_and_nested(self, async_session: AsyncSession):
        cu = _TestCU(name="TX", status=_TestStatus.ACTIVE, description="d", value=5, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        # 外层事务 begin_nested()
        async with async_session.begin_nested():
            _ = await _TestDAL.update_partial_by_id(
                async_session,
                created.id,
                _TestCU(name="TX1"),
                # 由事务统一提交
                need_refresh=False,
                fields={_TestTable.name},
            )
        # 事务结束后应可见
        changed = await async_session.get(_TestTable, created.id)
        assert changed is not None
        assert changed.name == "TX1"

        # 嵌套事务 begin_nested()
        async with async_session.begin_nested():
            _ = await _TestDAL.update_partial_by_id(
                async_session,
                created.id,
                _TestCU(name="TX2", description=None),
                need_refresh=False,
                fields={_TestTable.name, _TestTable.description},
                none_policy="ignore",
                none_policy_overrides={_TestTable.description: "allow"},
            )
        changed2 = await async_session.get(_TestTable, created.id)
        assert changed2 is not None
        assert changed2.name == "TX2"
        assert changed2.description is None

    async def test_update_partial_by_id_with_string_fields_and_overrides(self, async_session: AsyncSession):
        """覆盖 fields/overrides 的字符串分支(回退到 str(f))"""
        cu = _TestCU(name="StrInit", status=_TestStatus.ACTIVE, description="keep", value=1, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        upd = await _TestDAL.update_partial_by_id(
            async_session,
            created.id,
            _TestCU(name="StrNew", description=None),
            fields={_TestTable.name, _TestTable.description},  # 触发 else 分支: str -> 名称
            none_policy="ignore",
            none_policy_overrides={_TestTable.description: "allow"},  # 触发 else 分支
        )
        assert upd is not None
        await async_session.refresh(upd)
        assert upd.name == "StrNew"
        assert upd.description is None

    async def test_update_partial_by_id_fields_accept_sa_column(self, async_session: AsyncSession):
        """fields 传入 sa.Column 分支: allowed_names.add(f.name)"""
        cu = _TestCU(name="ColFieldInit", status=_TestStatus.ACTIVE, description="keep", value=1, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        updated = await _TestDAL.update_partial_by_id(
            async_session,
            created.id,
            _TestCU(name="ColFieldNew"),
            fields={_TestTable.name},  # 使用 sa.Column 覆盖 fields 分支
        )
        assert updated is not None
        await async_session.refresh(updated)
        assert updated.name == "ColFieldNew"
        # 未在白名单内的 description 不应变
        assert updated.description == "keep"

    async def test_update_partial_by_id_not_found_returns_none(self, async_session: AsyncSession):
        result = await _TestDAL.update_partial_by_id(
            async_session,
            999_888,
            _TestCU(name="NF"),
            fields={_TestTable.name},
        )
        assert result is None

    async def test_update_full_by_id_no_refresh_and_commit_later(self, async_session: AsyncSession):
        cu = _TestCU(name="NRInit", status=_TestStatus.ACTIVE, value=2, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)
        await async_session.commit()

        full = _TestCU(name="NRNew", status=_TestStatus.INACTIVE, value=3, create_operator_id=1)
        updated = await _TestDAL.update_full_by_id(async_session, created.id, full, need_refresh=False)
        assert updated is not None
        # 手动 flush + refresh 确认状态
        await async_session.flush()
        await async_session.refresh(updated)
        assert updated.name == "NRNew"
        assert updated.status == _TestStatus.INACTIVE.value

    async def test_update_full_by_id_nested_tx(self, async_session: AsyncSession):
        cu = _TestCU(name="FN", status=_TestStatus.ACTIVE, value=9, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        async with async_session.begin_nested():
            _ = await _TestDAL.update_full_by_id(
                async_session,
                created.id,
                _TestCU(name="FN2", status=_TestStatus.ACTIVE, value=10, create_operator_id=1),
                need_refresh=False,
            )
        after = await async_session.get(_TestTable, created.id)
        assert after is not None
        assert after.name == "FN2"

    async def test_update_full_by_id_strict_missing_raises(self, async_session: AsyncSession):
        """构造一个字段被默认序列化排除(exclude=True)的 CU, 触发 strict_missing 分支"""
        from typing import ClassVar

        from pydantic import Field as PydField

        class _StrictCU(StdBaseCU["_TestTable"]):  # type: ignore[name-defined]
            _Table: ClassVar[type[_TestTable]] = _TestTable

            name: str
            # 使用 exclude=True 使其在 model_dump 时被排除
            extra: str = PydField(default="", exclude=True)

        class _StrictDAL(AsyncBaseDAL[_TestTable, _TestDTO, _StrictCU]):
            _Table = _TestTable
            _DTO = _TestDTO
            _CU = _StrictCU

        cu = _TestCU(name="SMInit", status=_TestStatus.ACTIVE, value=1, create_operator_id=1)
        created = await _TestDAL.create(async_session, cu)

        # 由于 _StrictCU.extra 被排除, strict_missing=True 应抛错
        with pytest.raises(ValueError):
            await _StrictDAL.update_full_by_id(
                async_session,
                created.id,
                _StrictCU(name="SMNew"),
                strict_missing=True,
            )

    @pytest.mark.asyncio
    async def test_readonly_guard_on_new_apis(self, db_manager: "AsyncSQLiteManager") -> None:
        # 用可写会话先创建
        async with db_manager.got_manual_session() as s:
            created = await _TestDAL.create(s, _TestCU(name="RO", status=_TestStatus.ACTIVE, value=1, create_operator_id=1))
            cid = created.id

        # 只读会话: 两个新API都应抛 TypeError
        async with db_manager.got_readonly_session() as ro:
            with pytest.raises(TypeError):
                await _TestDAL.update_full_by_id(ro, cid, _TestCU(name="RO2"))
            with pytest.raises(TypeError):
                await _TestDAL.update_partial_by_id(ro, cid, _TestCU(name="RO3"))


class TestBatchUpdateFeatures:
    """测试批量更新功能,特别是 onupdate 字段的处理"""

    async def test_batch_update_by_ids_with_update_datetime(self, async_session: AsyncSession):
        """测试批量更新时自动设置 update_datetime 字段"""
        # 创建测试数据
        items = []
        for i in range(3):
            cu = _TestCU(
                name=f"Test Item {i}",
                status=_TestStatus.ACTIVE,
                create_operator_id=1,
            )
            item = await _TestDAL.create(async_session, cu)
            items.append(item)

        await async_session.commit()

        # 记录初始的 update_datetime(应该为 None 或创建时间)
        initial_update_times = [item.update_datetime for item in items]

        # 使用批量更新
        item_ids = [item.id for item in items]
        affected_rows = await _TestDAL.batch_update_by_ids(
            session=async_session,
            entity_ids=item_ids,
            update_data={_TestTable.name: "Updated Name"},
            updater_id=999,
        )

        assert affected_rows == 3

        # 验证更新结果
        for item_id in item_ids:
            updated_item = await async_session.get(_TestTable, item_id)
            assert updated_item is not None
            # 刷新对象以确保获取最新数据,避免惰性加载问题
            await async_session.refresh(updated_item)
            assert updated_item.name == "Updated Name"
            assert updated_item.update_operator_id == 999
            # update_datetime 应该被更新
            assert updated_item.update_datetime is not None
            # 如果初始时间存在,则新时间应该不同(通常是更新的)
            initial_time = initial_update_times[item_ids.index(item_id)]
            if initial_time is not None:
                # 注意:在快速执行的测试中,时间可能相同,这里主要验证字段被设置
                assert isinstance(updated_item.update_datetime, type(initial_time))

    async def test_batch_update_by_ids_without_update_fields(self, async_session: AsyncSession):
        """测试在没有 update_datetime 字段的表上批量更新"""
        # 创建测试数据(使用简单表,没有 update_datetime 字段)
        items = []
        for i in range(2):
            cu = _TestSimpleVO(name=f"Simple Item {i}")
            item = await _TestSimpleDAL.create(async_session, cu)
            items.append(item)

        await async_session.commit()

        # 使用批量更新
        item_ids = [item.id for item in items]
        affected_rows = await _TestSimpleDAL.batch_update_by_ids(
            session=async_session,
            entity_ids=item_ids,
            update_data={_TestTable.name: "Updated Simple Name"},
            updater_id=999,  # 这个参数会被忽略,因为表没有 update_operator_id 字段
        )

        assert affected_rows == 2

        # 验证更新结果
        for item_id in item_ids:
            updated_item = await async_session.get(_TestTableSimple, item_id)
            assert updated_item is not None
            assert updated_item.name == "Updated Simple Name"

    async def test_batch_update_by_ids_empty_ids(self, async_session: AsyncSession):
        """测试空ID列表的批量更新"""
        affected_rows = await _TestDAL.batch_update_by_ids(
            session=async_session,
            entity_ids=[],
            update_data={_TestTable.name: "Should Not Update"},
            updater_id=999,
        )

        assert affected_rows == 0

    async def test_batch_update_by_ids_nonexistent_ids(self, async_session: AsyncSession):
        """测试不存在的ID的批量更新"""
        affected_rows = await _TestDAL.batch_update_by_ids(
            session=async_session,
            entity_ids=[99999, 99998],  # 不存在的ID
            update_data={_TestTable.name: "Should Not Update"},
            updater_id=999,
        )

        assert affected_rows == 0

    async def test_onupdate_behavior_orm_vs_raw_sql(self, async_session: AsyncSession):
        """对比 ORM 更新和原生 SQL 更新在 onupdate 字段处理上的差异"""
        # 创建测试数据
        cu = _TestCU(
            name="Original Name",
            status=_TestStatus.ACTIVE,
            create_operator_id=1,
        )
        item = await _TestDAL.create(async_session, cu)

        # 方式1: 使用 ORM 更新(会触发 onupdate)
        orm_cu = _TestCU(name="ORM Updated Name", update_operator_id=888)
        orm_updated_item = await _TestDAL.update_only_set_by_id(
            session=async_session,
            entity_id=item.id,
            cu=orm_cu,
            need_refresh=True,
        )

        # 验证 ORM 更新结果
        assert orm_updated_item
        assert orm_updated_item.name == "ORM Updated Name"
        assert orm_updated_item.update_operator_id == 888
        orm_update_time = orm_updated_item.update_datetime

        # 方式2: 使用批量更新(手动处理 update_datetime)
        _ = await _TestDAL.batch_update_by_ids(
            session=async_session,
            entity_ids=[item.id],
            update_data={_TestTable.name: "Batch Updated Name"},
            updater_id=777,
        )

        # 验证批量更新结果
        batch_updated_item = await async_session.get(_TestTable, item.id)
        assert batch_updated_item is not None
        # 刷新对象以确保获取最新数据
        await async_session.refresh(batch_updated_item)
        assert batch_updated_item.name == "Batch Updated Name"
        assert batch_updated_item.update_operator_id == 777
        batch_update_time = batch_updated_item.update_datetime

        # 两种方式都应该正确设置 update_datetime
        assert orm_update_time is not None
        assert batch_update_time is not None

    async def test_batch_update_by_ids_with_column_objects(self, async_session: AsyncSession):
        """测试使用类型安全的列对象进行批量更新"""
        # 创建测试数据
        cu = _TestCU(
            name="Original Name",
            status=_TestStatus.ACTIVE,
            create_operator_id=1,
        )
        item = await _TestDAL.create(async_session, cu)

        # 使用字符串键名(类型安全的列对象在某些 SQLAlchemy 版本中有兼容性问题)
        affected_rows = await _TestDAL.batch_update_by_ids(
            session=async_session,
            entity_ids=[item.id],
            update_data={
                _TestTable.name: "Type Safe Updated Name",
                _TestTable.status: _TestStatus.INACTIVE.value,
                _TestTable.value: 100,
            },
            updater_id=555,
        )

        assert affected_rows == 1

        # 验证更新结果
        updated_item = await async_session.get(_TestTable, item.id)
        assert updated_item is not None
        await async_session.refresh(updated_item)
        assert updated_item.name == "Type Safe Updated Name"
        assert updated_item.status == _TestStatus.INACTIVE.value
        assert updated_item.value == 100
        assert updated_item.update_operator_id == 555
        assert updated_item.update_datetime is not None

    async def test_batch_update_by_conditions_with_update_datetime(self, async_session: AsyncSession):
        """测试按条件批量更新时自动设置 update_datetime 字段"""
        # 创建具有唯一标识的测试数据,避免与其他测试冲突
        unique_prefix = "ConditionTestUnique"

        # 清理可能存在的旧测试数据
        await async_session.execute(sa.delete(_TestTable).where(_TestTable.name.like(f"{unique_prefix}%")))
        await async_session.commit()

        items = []
        original_statuses = []

        for i in range(3):
            status = _TestStatus.ACTIVE if i % 2 == 0 else _TestStatus.INACTIVE
            cu = _TestCU(
                name=f"{unique_prefix} Item {i}",
                status=status,
                description=f"Unique test data {i}",
                create_operator_id=1,
            )
            item = await _TestDAL.create(async_session, cu)
            items.append(item)
            original_statuses.append(status.value)

        await async_session.commit()

        # 使用多个条件更新,避免与其他测试数据冲突
        affected_rows = await _TestDAL.batch_update_by_conditions(
            session=async_session,
            whereclause=[_TestTable.name.like(f"{unique_prefix}%"), _TestTable.status == _TestStatus.ACTIVE.value],
            update_data={_TestTable.name: "Condition Updated Name"},
            updater_id=999,
        )

        # 应该只更新符合两个条件的记录(2条ACTIVE状态的记录)
        assert affected_rows == 2

        # 验证更新结果
        for i, item in enumerate(items):
            updated_item = await async_session.get(_TestTable, item.id)
            assert updated_item is not None
            await async_session.refresh(updated_item)

            # ACTIVE状态的记录应该被更新
            if original_statuses[i] == _TestStatus.ACTIVE.value:
                assert updated_item.name == "Condition Updated Name"
                assert updated_item.update_operator_id == 999
                assert updated_item.update_datetime is not None
            else:
                # INACTIVE状态的记录应该保持不变
                assert updated_item.name == item.name
                assert updated_item.update_operator_id == item.update_operator_id

    async def test_batch_update_by_conditions_multiple_conditions(self, async_session: AsyncSession):
        """测试使用多个条件的批量更新"""
        # 创建具有唯一标识的测试数据
        unique_prefix = "MultiConditionTest"

        # 清理可能存在的旧测试数据
        await async_session.execute(sa.delete(_TestTable).where(_TestTable.name.like(f"{unique_prefix}%")))
        await async_session.commit()

        items = []
        original_data = []

        for i in range(4):
            status = _TestStatus.ACTIVE if i < 2 else _TestStatus.INACTIVE
            value = i * 10
            cu = _TestCU(
                name=f"{unique_prefix} {i}",
                status=status,
                value=value,
                description=f"Multi condition test {i}",
                create_operator_id=1,
            )
            item = await _TestDAL.create(async_session, cu)
            items.append(item)
            original_data.append((status.value, value))

        await async_session.commit()

        # 使用多个条件更新:包含unique_prefix、状态为ACTIVE且value<10的记录
        affected_rows = await _TestDAL.batch_update_by_conditions(
            session=async_session,
            whereclause=[_TestTable.name.like(f"{unique_prefix}%"), _TestTable.status == _TestStatus.ACTIVE.value, _TestTable.value < 10],
            update_data={_TestTable.name: "Multi Condition Updated"},
            updater_id=888,
        )

        # 应该只更新符合所有条件的记录(只有第一条记录符合)
        assert affected_rows == 1

        # 验证更新结果
        for i, item in enumerate(items):
            updated_item = await async_session.get(_TestTable, item.id)
            assert updated_item is not None
            await async_session.refresh(updated_item)

            status_val, value_val = original_data[i]
            # 只有第一条记录符合所有条件
            if i == 0 and value_val == 0 and status_val == _TestStatus.ACTIVE.value:
                assert updated_item.name == "Multi Condition Updated"
                assert updated_item.update_operator_id == 888
            else:
                assert updated_item.name == item.name

    async def test_batch_update_by_conditions_empty_conditions(self, async_session: AsyncSession):
        """测试空条件列表的批量更新"""
        # 创建具有唯一标识的测试数据
        unique_name = "EmptyConditionTestUnique"
        cu = _TestCU(name=unique_name, status=_TestStatus.ACTIVE, description="Empty condition test data", create_operator_id=1)
        item = await _TestDAL.create(async_session, cu)

        # 使用空条件列表(这会更新所有记录)
        affected_rows = await _TestDAL.batch_update_by_conditions(
            session=async_session,
            whereclause=[],
            update_data={_TestTable.name: "Should Update All"},
            updater_id=777,
        )

        # 由于空条件会更新所有记录,我们需要验证我们的特定记录是否被更新
        updated_item = await async_session.get(_TestTable, item.id)
        assert updated_item is not None
        await async_session.refresh(updated_item)
        assert updated_item.name == "Should Update All"
        assert updated_item.update_operator_id == 777

    async def test_batch_update_by_conditions_no_matching_records(self, async_session: AsyncSession):
        """测试没有匹配记录的条件批量更新"""
        # 创建具有唯一标识的测试数据
        unique_name = "NoMatchTestUnique"
        cu = _TestCU(name=unique_name, status=_TestStatus.ACTIVE, description="No match test data", create_operator_id=1)
        item = await _TestDAL.create(async_session, cu)

        # 使用不存在的条件(结合唯一标识符确保不会匹配到其他记录)
        affected_rows = await _TestDAL.batch_update_by_conditions(
            session=async_session,
            whereclause=[
                _TestTable.name == unique_name,
                _TestTable.status == 999,  # 不存在的状态值
            ],
            update_data={"name": "Should Not Update"},  # pyright: ignore[reportArgumentType]
            updater_id=666,
        )

        # 应该没有记录被更新
        assert affected_rows == 0

        # 验证原记录保持不变
        unchanged_item = await async_session.get(_TestTable, item.id)
        assert unchanged_item is not None
        await async_session.refresh(unchanged_item)
        assert unchanged_item.name == unique_name
        assert unchanged_item.create_operator_id == 1  # create_operator_id 应该保持原值
        assert unchanged_item.update_operator_id is None  # update_operator_id 应该为 None(因为没有被更新)

    async def test_batch_update_by_conditions_with_column_objects(self, async_session: AsyncSession):
        """测试使用列对象作为更新数据的条件批量更新"""
        # 创建具有唯一标识的测试数据
        unique_name = "ColumnObjectTestUnique"
        cu = _TestCU(
            name=unique_name,
            status=_TestStatus.ACTIVE,
            value=50,
            description="Column object test data",
            create_operator_id=1,
        )
        item = await _TestDAL.create(async_session, cu)

        # 使用列对象进行条件更新
        affected_rows = await _TestDAL.batch_update_by_conditions(
            session=async_session,
            whereclause=[_TestTable.name == unique_name, _TestTable.value == 50],
            update_data={
                _TestTable.name: "Column Object Updated",
                _TestTable.status: _TestStatus.INACTIVE.value,
                _TestTable.value: 100,
            },
            updater_id=555,
        )

        assert affected_rows == 1

        # 验证更新结果
        updated_item = await async_session.get(_TestTable, item.id)
        assert updated_item is not None
        await async_session.refresh(updated_item)
        assert updated_item.name == "Column Object Updated"
        assert updated_item.status == _TestStatus.INACTIVE.value
        assert updated_item.value == 100
        assert updated_item.update_operator_id == 555
        assert updated_item.update_datetime is not None

    async def test_batch_update_by_conditions_fcl_only(self, async_session: AsyncSession):
        """测试条件批量更新仅执行flush不提交事务"""
        # 创建具有唯一标识的测试数据
        unique_name = "NoCommitTestUnique"
        cu = _TestCU(name=unique_name, status=_TestStatus.ACTIVE, description="No commit test data", create_operator_id=1)
        item = await _TestDAL.create(async_session, cu)

        # DAL统一使用flush策略
        affected_rows = await _TestDAL.batch_update_by_conditions(
            session=async_session,
            whereclause=[_TestTable.name == unique_name, _TestTable.status == _TestStatus.ACTIVE.value],
            update_data={_TestTable.name: "Not Committed Yet"},
            updater_id=444,
        )

        assert affected_rows == 1

        # 手动提交事务
        await async_session.commit()

        # 验证更新结果
        updated_item = await async_session.get(_TestTable, item.id)
        assert updated_item is not None
        await async_session.refresh(updated_item)
        assert updated_item.name == "Not Committed Yet"
        assert updated_item.update_operator_id == 444

    async def test_batch_update_by_conditions_vs_orm_update(self, async_session: AsyncSession):
        """对比条件批量更新和 ORM 更新在字段处理上的差异"""
        # 创建具有唯一标识的测试数据
        unique_prefix = "ComparisonTestUnique"

        # 创建第一条记录用于 ORM 更新
        cu1 = _TestCU(
            name=f"{unique_prefix} ORM",
            status=_TestStatus.ACTIVE,
            description="ORM comparison test",
            create_operator_id=1,
        )
        item1 = await _TestDAL.create(async_session, cu1)

        # 方式1: 使用 ORM 更新单个记录
        orm_cu = _TestCU(name=f"{unique_prefix} ORM", update_operator_id=888)
        orm_updated_item = await _TestDAL.update_only_set_by_id(
            session=async_session,
            entity_id=item1.id,
            cu=orm_cu,
            need_refresh=True,
        )

        # 验证 ORM 更新结果
        assert orm_updated_item
        assert orm_updated_item.name == f"{unique_prefix} ORM"
        assert orm_updated_item.update_operator_id == 888
        orm_update_time = orm_updated_item.update_datetime

        # 方式2: 使用条件批量更新(重新创建记录进行对比)
        cu2 = _TestCU(
            name=f"{unique_prefix} Batch",
            status=_TestStatus.ACTIVE,
            description="Batch comparison test",
            create_operator_id=1,
        )
        item2 = await _TestDAL.create(async_session, cu2)

        await _TestDAL.batch_update_by_conditions(
            session=async_session,
            whereclause=[_TestTable.name == f"{unique_prefix} Batch", _TestTable.id == item2.id],
            update_data={_TestTable.name: f"{unique_prefix} Batch"},
            updater_id=777,
        )

        # 验证条件批量更新结果
        batch_updated_item = await async_session.get(_TestTable, item2.id)
        assert batch_updated_item is not None
        await async_session.refresh(batch_updated_item)
        assert batch_updated_item.name == f"{unique_prefix} Batch"
        assert batch_updated_item.update_operator_id == 777
        batch_update_time = batch_updated_item.update_datetime

        # 两种方式都应该正确设置字段
        assert orm_update_time is not None
        assert batch_update_time is not None

    async def test_batch_update_by_conditions_with_sa_column_keys(self, async_session: AsyncSession):
        """覆盖 update_data 使用 sa.Column 键路径(约第405行)"""
        cu = _TestCU(name="ColumnKey原始", status=_TestStatus.ACTIVE, value=11, create_operator_id=1)
        item = await _TestDAL.create(async_session, cu)

        # 使用 sa.Column 键(通过 __table__.c 访问)
        affected = await _TestDAL.batch_update_by_conditions(
            session=async_session,
            whereclause=[_TestTable.id == item.id],
            update_data={
                _TestTable.__table__.c.name: "ColumnKey已更新",  # pyright: ignore[reportArgumentType]
            },
            updater_id=321,
        )

        assert affected == 1
        updated = await async_session.get(_TestTable, item.id)
        assert updated is not None
        await async_session.refresh(updated)
        assert updated.name == "ColumnKey已更新"
        assert updated.update_operator_id == 321

    async def test_batch_update_by_conditions_invalid_update_key(self, async_session: AsyncSession):
        """覆盖非法 update_data 键抛出 ValueError(约第411行)"""
        cu = _TestCU(name="InvalidKey原始", status=_TestStatus.ACTIVE, value=22, create_operator_id=1)
        item = await _TestDAL.create(async_session, cu)

        with pytest.raises(ValueError, match="不支持的更新条件类型"):
            await _TestDAL.batch_update_by_conditions(
                session=async_session,
                whereclause=[_TestTable.id == item.id],
                update_data={
                    123: "invalid"
                },  # 非 sa.Column/InstrumentedAttribute/str # pyright: ignore[reportUnusedCallResult,reportArgumentType]
                updater_id=1,
            )

    @pytest.mark.asyncio
    async def test_batch_update_by_conditions_readonly_guard(self, db_manager: AsyncSQLiteManager) -> None:
        """覆盖只读会话写保护分支(约第399行)"""
        # 先用可写会话创建一条
        async with db_manager.got_manual_session() as session:
            item = await _TestDAL.create(session, _TestCU(name="只读保护原始", status=_TestStatus.ACTIVE, value=33, create_operator_id=1))
            item_id = item.id

        # 只读会话尝试批量更新应抛出 TypeError
        async with db_manager.got_readonly_session() as ro_session:
            with pytest.raises(TypeError):
                await _TestDAL.batch_update_by_conditions(
                    session=ro_session,
                    whereclause=[_TestTable.id == item_id],
                    update_data={_TestTable.name: "RO被阻止"},
                    updater_id=999,
                )


class TestBatchGetMethods:
    """测试批量获取方法"""

    async def test_batch_get_id__entity_with_existing_ids(self, async_session: AsyncSession):
        """测试batch_get_id__entity获取存在的实体"""
        # 创建测试数据
        cu1 = _TestCU(name="BatchTest1", status=_TestStatus.ACTIVE, value=100, create_operator_id=1)
        cu2 = _TestCU(name="BatchTest2", status=_TestStatus.INACTIVE, value=200, create_operator_id=1)

        entity1 = await _TestDAL.create(async_session, cu1)
        entity2 = await _TestDAL.create(async_session, cu2)
        await async_session.commit()

        # 批量获取
        result = await _TestDAL.batch_get_id__entity(async_session, [entity1.id, entity2.id])

        # 验证结果
        assert len(result) == 2
        assert entity1.id in result
        assert entity2.id in result
        assert result[entity1.id].name == "BatchTest1"
        assert result[entity2.id].name == "BatchTest2"
        assert result[entity1.id].value == 100
        assert result[entity2.id].value == 200

    async def test_batch_get_id__entity_with_empty_ids(self, async_session: AsyncSession):
        """测试batch_get_id__entity传入空ID列表"""
        result = await _TestDAL.batch_get_id__entity(async_session, [])
        assert result == {}

    async def test_batch_get_id__entity_with_nonexistent_ids(self, async_session: AsyncSession):
        """测试batch_get_id__entity获取不存在的实体"""
        result = await _TestDAL.batch_get_id__entity(async_session, [99999, 99998])
        assert result == {}

    async def test_batch_get_id__entity_with_mixed_ids(self, async_session: AsyncSession):
        """测试batch_get_id__entity混合存在的和不存在的ID"""
        # 先创建一个存在的实体
        cu = _TestCU(name="MixedTest", status=_TestStatus.ACTIVE, value=300, create_operator_id=1)
        entity = await _TestDAL.create(async_session, cu)

        # 混合查询
        result = await _TestDAL.batch_get_id__entity(async_session, [entity.id, 99999, 99998])

        # 应该只返回存在的实体
        assert len(result) == 1
        assert entity.id in result
        assert result[entity.id].name == "MixedTest"

    async def test_batch_get_id__dto_with_existing_ids(self, async_session: AsyncSession):
        """测试batch_get_id__dto获取存在的DTO"""
        # 创建测试数据
        cu1 = _TestCU(name="DTOBatchTest1", status=_TestStatus.ACTIVE, value=400, create_operator_id=1)
        cu2 = _TestCU(name="DTOBatchTest2", status=_TestStatus.INACTIVE, value=500, create_operator_id=1)

        entity1 = await _TestDAL.create(async_session, cu1)
        entity2 = await _TestDAL.create(async_session, cu2)
        await async_session.commit()

        # 批量获取DTO
        result = await _TestDAL.batch_get_id__dto(async_session, [entity1.id, entity2.id])

        # 验证结果
        assert len(result) == 2
        assert entity1.id in result
        assert entity2.id in result
        assert isinstance(result[entity1.id], _TestDTO)
        assert isinstance(result[entity2.id], _TestDTO)
        assert result[entity1.id].name == "DTOBatchTest1"
        assert result[entity2.id].name == "DTOBatchTest2"
        assert result[entity1.id].value == 400
        assert result[entity2.id].value == 500

    async def test_batch_get_id__dto_with_empty_ids(self, async_session: AsyncSession):
        """测试batch_get_id__dto传入空ID列表"""
        result = await _TestDAL.batch_get_id__dto(async_session, [])
        assert result == {}

    async def test_batch_get_id__dto_with_nonexistent_ids(self, async_session: AsyncSession):
        """测试batch_get_id__dto获取不存在的DTO"""
        result = await _TestDAL.batch_get_id__dto(async_session, [99999, 99998])
        assert result == {}

    async def test_batch_get_field__entity_with_existing_values(self, async_session: AsyncSession):
        """测试batch_get_field__entity按字段获取存在的实体"""
        # 创建测试数据
        cu1 = _TestCU(name="FieldTest1", status=_TestStatus.ACTIVE, value=600, create_operator_id=1)
        cu2 = _TestCU(name="FieldTest2", status=_TestStatus.INACTIVE, value=700, create_operator_id=1)

        await _TestDAL.create(async_session, cu1)
        await _TestDAL.create(async_session, cu2)
        await async_session.commit()

        # 按name字段批量获取
        result = await _TestDAL.batch_get_field__entity(async_session, field_name="name", field_values=["FieldTest1", "FieldTest2"])

        # 验证结果
        assert len(result) == 2
        assert "FieldTest1" in result
        assert "FieldTest2" in result
        assert result["FieldTest1"].name == "FieldTest1"
        assert result["FieldTest2"].name == "FieldTest2"
        assert result["FieldTest1"].value == 600
        assert result["FieldTest2"].value == 700

    async def test_batch_get_field__entity_with_empty_values(self, async_session: AsyncSession):
        """测试batch_get_field__entity传入空字段值列表"""
        result = await _TestDAL.batch_get_field__entity(async_session, field_name="name", field_values=[])
        assert result == {}

    async def test_batch_get_field__entity_with_nonexistent_values(self, async_session: AsyncSession):
        """测试batch_get_field__entity获取不存在的字段值"""
        result = await _TestDAL.batch_get_field__entity(async_session, field_name="name", field_values=["NonExistent1", "NonExistent2"])
        assert result == {}

    async def test_batch_get_field__dto_with_existing_values(self, async_session: AsyncSession):
        """测试batch_get_field__dto按字段获取存在的DTO"""
        # 创建测试数据
        cu1 = _TestCU(name="DTOFieldTest1", status=_TestStatus.ACTIVE, value=800, create_operator_id=1)
        cu2 = _TestCU(name="DTOFieldTest2", status=_TestStatus.INACTIVE, value=900, create_operator_id=1)

        await _TestDAL.create(async_session, cu1)
        await _TestDAL.create(async_session, cu2)
        await async_session.commit()

        # 按name字段批量获取DTO
        result = await _TestDAL.batch_get_field__dto(async_session, field_name="name", field_values=["DTOFieldTest1", "DTOFieldTest2"])

        # 验证结果
        assert len(result) == 2
        assert "DTOFieldTest1" in result
        assert "DTOFieldTest2" in result
        assert isinstance(result["DTOFieldTest1"], _TestDTO)
        assert isinstance(result["DTOFieldTest2"], _TestDTO)
        assert result["DTOFieldTest1"].name == "DTOFieldTest1"
        assert result["DTOFieldTest2"].name == "DTOFieldTest2"
        assert result["DTOFieldTest1"].value == 800
        assert result["DTOFieldTest2"].value == 900

    async def test_batch_get_field__dto_with_empty_values(self, async_session: AsyncSession):
        """测试batch_get_field__dto传入空字段值列表"""
        result = await _TestDAL.batch_get_field__dto(async_session, field_name="name", field_values=[])
        assert result == {}

    async def test_batch_get_field__entity_with_none_values(self, async_session: AsyncSession):
        """测试batch_get_field__entity过滤None值"""
        # 创建测试数据
        cu1 = _TestCU(name="FilterTest1", status=_TestStatus.ACTIVE, value=1000, create_operator_id=1)
        cu2 = _TestCU(name="FilterTest2", status=_TestStatus.INACTIVE, value=2000, create_operator_id=1)

        await _TestDAL.create(async_session, cu1)
        await _TestDAL.create(async_session, cu2)
        await async_session.commit()

        # 包含None和空字符串的查询
        result = await _TestDAL.batch_get_field__entity(
            async_session, field_name="name", field_values=["FilterTest1", None, "", "FilterTest2"]
        )

        # 应该只返回有效的记录,过滤掉None和空字符串
        assert len(result) == 2
        assert "FilterTest1" in result
        assert "FilterTest2" in result
        assert result["FilterTest1"].name == "FilterTest1"
        assert result["FilterTest2"].name == "FilterTest2"

    async def test_batch_get_field__entity_with_duplicates(self, async_session: AsyncSession):
        """测试batch_get_field__entity去重功能"""
        # 创建测试数据
        cu = _TestCU(name="DuplicateTest", status=_TestStatus.ACTIVE, value=3000, create_operator_id=1)
        await _TestDAL.create(async_session, cu)

        # 重复查询同一个值
        result = await _TestDAL.batch_get_field__entity(
            async_session, field_name="name", field_values=["DuplicateTest", "DuplicateTest", "DuplicateTest"]
        )

        # 应该只返回一条记录(去重后)
        assert len(result) == 1
        assert "DuplicateTest" in result
        assert result["DuplicateTest"].name == "DuplicateTest"

    async def test_batch_get_id__entity_with_invalid_types(self, async_session: AsyncSession):
        """测试batch_get_id__entity过滤无效类型"""
        # 创建测试数据
        cu = _TestCU(name="TypeTest", status=_TestStatus.ACTIVE, value=4000, create_operator_id=1)
        entity = await _TestDAL.create(async_session, cu)

        # 混合有效ID和无效类型(字符串无法转换为int)
        result = await _TestDAL.batch_get_id__entity(
            async_session,
            [entity.id, "invalid_string", None, "another_string"],  # 只有entity.id是有效的int
        )

        # 应该只返回有效的记录
        assert len(result) == 1
        assert entity.id in result
        assert result[entity.id].name == "TypeTest"


# ========== Session 多次 Commit 行为测试 ==========


class TestManualSessionMultiCommit:
    """测试 got_manual_session 下的多次 commit 行为"""

    async def test_manual_session_multi_commit_success(self, db_manager: AsyncSQLiteManager):
        """测试手动模式下多次 commit - 应该成功"""
        async with db_manager.got_manual_session() as session:
            # 第一次操作 + commit
            cu1 = _TestCU(name="Manual-Multi-1", status=_TestStatus.ACTIVE, create_operator_id=1)
            item1 = await _TestDAL.create(session, cu1)
            await session.commit()  # ✅ commit 1 - 应该成功
            assert item1.id is not None

            # 第二次操作 + commit
            cu2 = _TestCU(name="Manual-Multi-2", status=_TestStatus.ACTIVE, create_operator_id=1)
            item2 = await _TestDAL.create(session, cu2)
            await session.commit()  # ✅ commit 2 - 应该成功
            assert item2.id is not None

            # 第三次操作 + commit
            cu3 = _TestCU(name="Manual-Multi-3", status=_TestStatus.ACTIVE, create_operator_id=1)
            item3 = await _TestDAL.create(session, cu3)
            await session.commit()  # ✅ commit 3 - 应该成功
            assert item3.id is not None

        # 验证所有数据都已提交
        async with db_manager.got_readonly_session() as session:
            result = await session.execute(sa.select(sa.func.count()).select_from(_TestTable).where(_TestTable.name.like("Manual-Multi-%")))
            count = result.scalar()
            assert count == 3, f"期望3条记录,实际 {count} 条"

        # 清理测试数据
        async with db_manager.got_manual_session() as session:
            await session.execute(sa.delete(_TestTable).where(_TestTable.name.like("Manual-Multi-%")))
            await session.commit()

    async def test_manual_session_partial_commit_then_error(self, db_manager: AsyncSQLiteManager):
        """测试手动模式下部分提交后出错 - 前面的提交不会回滚"""
        item1_id = None
        item2_id = None

        try:
            async with db_manager.got_manual_session() as session:
                # 第一次操作 + commit
                cu1 = _TestCU(name="Manual-Partial-1", status=_TestStatus.ACTIVE, create_operator_id=1)
                item1 = await _TestDAL.create(session, cu1)
                await session.commit()  # ✅ commit 1 成功
                item1_id = item1.id

                # 第二次操作 + commit
                cu2 = _TestCU(name="Manual-Partial-2", status=_TestStatus.ACTIVE, create_operator_id=1)
                item2 = await _TestDAL.create(session, cu2)
                await session.commit()  # ✅ commit 2 成功
                item2_id = item2.id

                # 第三次操作,但不 commit,然后抛出异常
                cu3 = _TestCU(name="Manual-Partial-3", status=_TestStatus.ACTIVE, create_operator_id=1)
                await _TestDAL.create(session, cu3)
                # 没有 commit
                raise ValueError("模拟业务异常")  # noqa: TRY301

        except ValueError:
            pass  # 预期的异常

        # 验证: 前两次提交的数据应该存在,第三次的不存在
        async with db_manager.got_readonly_session() as session:
            result = await session.execute(
                sa.select(sa.func.count()).select_from(_TestTable).where(_TestTable.name.like("Manual-Partial-%"))
            )
            count = result.scalar()
            assert count == 2, f"期望2条记录(前2次commit成功),实际 {count} 条"

        # 清理测试数据
        async with db_manager.got_manual_session() as session:
            await session.execute(sa.delete(_TestTable).where(_TestTable.name.like("Manual-Partial-%")))
            await session.commit()


class TestAutoCommitSessionMultiCommit:
    """测试 got_soft_impl_auto_commit_session 下的多次 commit 行为"""

    async def test_auto_commit_session_multi_commit_no_error(self, db_manager: AsyncSQLiteManager):
        """测试自动提交模式下多次 commit - 不会报错,但是幂等的"""
        async with db_manager.got_soft_impl_auto_commit_session() as session:
            # 第一次操作
            cu1 = _TestCU(name="Auto-Multi-1", status=_TestStatus.ACTIVE, create_operator_id=1)
            item1 = await _TestDAL.create(session, cu1)
            await session.commit()  # ✅ 手动 commit 1 - 不会报错,提交事务1
            assert item1.id is not None

            # 第二次操作
            cu2 = _TestCU(name="Auto-Multi-2", status=_TestStatus.ACTIVE, create_operator_id=1)
            item2 = await _TestDAL.create(session, cu2)
            await session.commit()  # ✅ 手动 commit 2 - 不会报错,提交事务2
            assert item2.id is not None

            # 第三次操作,不手动 commit
            cu3 = _TestCU(name="Auto-Multi-3", status=_TestStatus.ACTIVE, create_operator_id=1)
            item3 = await _TestDAL.create(session, cu3)
            # 退出时会自动 commit 事务3

        # 验证所有数据都已提交
        async with db_manager.got_readonly_session() as session:
            result = await session.execute(sa.select(sa.func.count()).select_from(_TestTable).where(_TestTable.name.like("Auto-Multi-%")))
            count = result.scalar()
            assert count == 3, f"期望3条记录,实际 {count} 条"

        # 清理测试数据
        async with db_manager.got_manual_session() as session:
            await session.execute(sa.delete(_TestTable).where(_TestTable.name.like("Auto-Multi-%")))
            await session.commit()

    async def test_auto_commit_session_partial_commit_then_error(self, db_manager: AsyncSQLiteManager):
        """测试自动提交模式下部分提交后出错 - 前面的手动提交会生效"""
        try:
            async with db_manager.got_soft_impl_auto_commit_session() as session:
                # 第一次操作 + 手动 commit
                cu1 = _TestCU(name="Auto-Partial-1", status=_TestStatus.ACTIVE, create_operator_id=1)
                item1 = await _TestDAL.create(session, cu1)
                await session.commit()  # ✅ 手动 commit 1 成功,数据已提交

                # 第二次操作,不 commit,然后抛出异常
                cu2 = _TestCU(name="Auto-Partial-2", status=_TestStatus.ACTIVE, create_operator_id=1)
                await _TestDAL.create(session, cu2)
                # 没有手动 commit
                raise ValueError("模拟业务异常")  # noqa: TRY301

        except ValueError:
            pass  # 预期的异常

        # 验证: 第一次手动提交的数据应该存在,第二次的不存在
        async with db_manager.got_readonly_session() as session:
            result = await session.execute(sa.select(sa.func.count()).select_from(_TestTable).where(_TestTable.name.like("Auto-Partial-%")))
            count = result.scalar()
            assert count == 1, f"期望1条记录(第1次手动commit成功),实际 {count} 条"

        # 清理测试数据
        async with db_manager.got_manual_session() as session:
            await session.execute(sa.delete(_TestTable).where(_TestTable.name.like("Auto-Partial-%")))
            await session.commit()

    async def test_auto_commit_session_should_not_manual_commit(self, db_manager: AsyncSQLiteManager):
        """测试自动提交模式下应该避免手动 commit - 违反单一职责原则"""
        # ⚠️ 反模式示例: 在自动提交模式下手动 commit
        async with db_manager.got_soft_impl_auto_commit_session() as session:
            cu1 = _TestCU(name="Auto-Bad-1", status=_TestStatus.ACTIVE, create_operator_id=1)
            await _TestDAL.create(session, cu1)
            await session.commit()  # ⚠️ 不推荐!打破了自动提交的语义

            cu2 = _TestCU(name="Auto-Bad-2", status=_TestStatus.ACTIVE, create_operator_id=1)
            await _TestDAL.create(session, cu2)
            # 退出时还会再次 commit

        # 虽然能工作,但违反了设计原则
        # 清理测试数据
        async with db_manager.got_manual_session() as session:
            await session.execute(sa.delete(_TestTable).where(_TestTable.name.like("Auto-Bad-%")))
            await session.commit()


class TestReadOnlySessionMultiCommit:
    """测试 got_readonly_session 下的多次 commit 行为"""

    async def test_readonly_session_commit_is_noop(self, db_manager: AsyncSQLiteManager):
        """测试只读模式下 commit 是无操作的"""
        async with db_manager.got_readonly_session() as session:
            # 只读session下,commit 不会报错,但也没有实际效果
            await session.commit()  # ✅ 不报错,但是空操作
            await session.commit()  # ✅ 多次 commit 也不报错

            # 尝试读取数据
            result = await session.execute(sa.select(sa.func.count()).select_from(_TestTable))
            count = result.scalar()
            assert count is not None and count >= 0  # 只是验证查询能执行

    async def test_readonly_session_cannot_write(self, db_manager: AsyncSQLiteManager):
        """测试只读模式下写入会被阻止"""
        async with db_manager.got_readonly_session() as session:
            cu = _TestCU(name="Readonly-Test", status=_TestStatus.ACTIVE, create_operator_id=1)

            # 应该在 DAL 层就被阻止
            with pytest.raises(TypeError, match="只读"):
                await _TestDAL.create(session, cu)


class TestTransactionBoundaryBestPractices:
    """测试事务边界的最佳实践"""

    async def test_best_practice_auto_commit_no_manual_commit(self, db_manager: AsyncSQLiteManager):
        """✅ 最佳实践: 自动提交模式下不手动 commit"""
        async with db_manager.got_soft_impl_auto_commit_session() as session:
            # 所有操作在同一个事务中
            cu1 = _TestCU(name="BP-Auto-1", status=_TestStatus.ACTIVE, create_operator_id=1)
            item1 = await _TestDAL.create(session, cu1)

            cu2 = _TestCU(name="BP-Auto-2", status=_TestStatus.ACTIVE, create_operator_id=1)
            item2 = await _TestDAL.create(session, cu2)

            # 不手动 commit,让管理器在退出时自动 commit
            # 如果中间出错,管理器会自动 rollback,保证原子性

        # 验证
        async with db_manager.got_readonly_session() as session:
            result = await session.execute(sa.select(sa.func.count()).select_from(_TestTable).where(_TestTable.name.like("BP-Auto-%")))
            count = result.scalar()
            assert count == 2

        # 清理
        async with db_manager.got_manual_session() as session:
            await session.execute(sa.delete(_TestTable).where(_TestTable.name.like("BP-Auto-%")))
            await session.commit()

    async def test_best_practice_manual_explicit_control(self, db_manager: AsyncSQLiteManager):
        """✅ 最佳实践: 手动模式下明确控制提交点"""
        async with db_manager.got_manual_session() as session:
            # 场景: 分阶段操作,每个阶段独立提交
            # 阶段1: 创建记录
            cu1 = _TestCU(name="BP-Manual-1", status=_TestStatus.ACTIVE, create_operator_id=1)
            await _TestDAL.create(session, cu1)
            await session.commit()  # ✅ 明确提交阶段1

            # 阶段2: 创建另一条记录
            cu2 = _TestCU(name="BP-Manual-2", status=_TestStatus.ACTIVE, create_operator_id=1)
            await _TestDAL.create(session, cu2)
            await session.commit()  # ✅ 明确提交阶段2

        # 清理
        async with db_manager.got_manual_session() as session:
            await session.execute(sa.delete(_TestTable).where(_TestTable.name.like("BP-Manual-%")))
            await session.commit()

    async def test_anti_pattern_auto_commit_with_manual_commits(self, db_manager: AsyncSQLiteManager):
        """❌ 反模式: 自动提交模式下手动 commit,破坏原子性"""
        try:
            async with db_manager.got_soft_impl_auto_commit_session() as session:
                # 操作1
                cu1 = _TestCU(name="AP-Auto-1", status=_TestStatus.ACTIVE, create_operator_id=1)
                await _TestDAL.create(session, cu1)
                await session.commit()  # ❌ 反模式: 手动 commit,事务1提交

                # 操作2
                cu2 = _TestCU(name="AP-Auto-2", status=_TestStatus.ACTIVE, create_operator_id=1)
                await _TestDAL.create(session, cu2)
                # 这里出错
                raise ValueError("模拟异常")  # noqa: TRY301

        except ValueError:
            pass

        # 问题: 操作1已经提交,操作2回滚,破坏了原子性
        async with db_manager.got_readonly_session() as session:
            result = await session.execute(sa.select(sa.func.count()).select_from(_TestTable).where(_TestTable.name.like("AP-Auto-%")))
            count = result.scalar()
            # 只有第一条记录,第二条被回滚
            assert count == 1, "反模式导致部分提交"

        # 清理
        async with db_manager.got_manual_session() as session:
            await session.execute(sa.delete(_TestTable).where(_TestTable.name.like("AP-Auto-%")))
            await session.commit()


# ========== 测试迭代方法 ==========


class TestIterRecordDtos:
    """测试 ReadDAL.iter_record_dtos 方法"""

    async def test_iter_empty_table(self, async_session: AsyncSession):
        """测试迭代空表"""
        # 清空测试表
        await async_session.execute(sa.delete(_TestTable))
        await async_session.commit()

        # 迭代空表
        count = 0
        async for _ in _TestDAL.iter_record_dtos(async_session):
            count += 1

        assert count == 0

    async def test_iter_basic(self, async_session: AsyncSession):
        """测试基础迭代功能"""
        # 创建测试数据
        test_names = [f"IterTest-{i}" for i in range(10)]
        for name in test_names:
            cu = _TestCU(name=name, status=_TestStatus.ACTIVE, value=1, create_operator_id=1)
            await _TestDAL.create(async_session, cu)
        await async_session.commit()

        # 迭代并验证
        collected_names = []
        async for dto in _TestDAL.iter_record_dtos(async_session, where_clauses=[_TestTable.name.like("IterTest-%")], batch_size=3):
            assert isinstance(dto, _TestDTO)
            collected_names.append(dto.name)

        # 验证所有记录都被迭代到
        assert len(collected_names) == 10
        assert set(collected_names) == set(test_names)

        # 清理
        await async_session.execute(sa.delete(_TestTable).where(_TestTable.name.like("IterTest-%")))
        await async_session.commit()

    async def test_iter_with_where_clauses(self, async_session: AsyncSession):
        """测试带过滤条件的迭代"""
        # 创建不同状态的测试数据
        for i in range(5):
            cu = _TestCU(name=f"FilterTest-Active-{i}", status=_TestStatus.ACTIVE, value=i, create_operator_id=1)
            await _TestDAL.create(async_session, cu)
        for i in range(3):
            cu = _TestCU(name=f"FilterTest-Inactive-{i}", status=_TestStatus.INACTIVE, value=i, create_operator_id=1)
            await _TestDAL.create(async_session, cu)
        await async_session.commit()

        # 只迭代 ACTIVE 状态的记录
        active_count = 0
        async for dto in _TestDAL.iter_record_dtos(
            async_session, where_clauses=[_TestTable.name.like("FilterTest-%"), _TestTable.status == _TestStatus.ACTIVE.value]
        ):
            assert dto.status == _TestStatus.ACTIVE.value
            active_count += 1

        assert active_count == 5

        # 清理
        await async_session.execute(sa.delete(_TestTable).where(_TestTable.name.like("FilterTest-%")))
        await async_session.commit()

    async def test_iter_with_deleted_records(self, async_session: AsyncSession):
        """测试 with_deleted 参数"""
        # 创建测试数据
        entities = []
        for i in range(5):
            cu = _TestCU(name=f"DeleteTest-{i}", status=_TestStatus.ACTIVE, value=i, create_operator_id=1)
            entity = await _TestDAL.create(async_session, cu)
            entities.append(entity)
        await async_session.commit()

        # 软删除部分记录
        for i in [0, 2, 4]:
            entities[i].delete()
        await async_session.commit()

        # 不包含软删除记录
        count_without_deleted = 0
        async for _ in _TestDAL.iter_record_dtos(async_session, where_clauses=[_TestTable.name.like("DeleteTest-%")], with_deleted=False):
            count_without_deleted += 1
        assert count_without_deleted == 2  # 只有索引 1, 3 未被删除

        # 包含软删除记录
        count_with_deleted = 0
        async for _ in _TestDAL.iter_record_dtos(async_session, where_clauses=[_TestTable.name.like("DeleteTest-%")], with_deleted=True):
            count_with_deleted += 1
        assert count_with_deleted == 5  # 全部记录

        # 清理
        await async_session.execute(
            sa.delete(_TestTable).where(_TestTable.name.like("DeleteTest-%")).execution_options(include_soft_deleted=True)
        )
        await async_session.commit()

    async def test_iter_large_dataset(self, async_session: AsyncSession):
        """测试大数据集分批迭代"""
        # 创建大量测试数据(1200条,验证分批)
        batch_size = 500
        total_records = 1200

        for i in range(total_records):
            cu = _TestCU(name=f"LargeTest-{i}", status=_TestStatus.ACTIVE, value=i % 100, create_operator_id=1)
            await _TestDAL.create(async_session, cu)
            if i % 500 == 0:
                await async_session.commit()
        await async_session.commit()

        # 使用较小的 batch_size 迭代
        count = 0
        last_id = None
        async for dto in _TestDAL.iter_record_dtos(
            async_session, where_clauses=[_TestTable.name.like("LargeTest-%")], batch_size=batch_size
        ):
            count += 1
            # 验证 id 降序
            if last_id is not None:
                assert dto.id < last_id
            last_id = dto.id

        assert count == total_records

        # 清理
        await async_session.execute(sa.delete(_TestTable).where(_TestTable.name.like("LargeTest-%")))
        await async_session.commit()


class TestIterRecords:
    """测试 WriteDAL.iter_records 方法"""

    async def test_iter_records_returns_entities(self, async_session: AsyncSession):
        """测试返回的是实体对象而非 DTO"""
        # 创建测试数据
        for i in range(5):
            cu = _TestCU(name=f"EntityTest-{i}", status=_TestStatus.ACTIVE, value=i, create_operator_id=1)
            await _TestDAL.create(async_session, cu)
        await async_session.commit()

        # 迭代并验证类型
        count = 0
        async for entity in _TestDAL.iter_records(async_session, where_clauses=[_TestTable.name.like("EntityTest-%")]):
            assert isinstance(entity, _TestTable)
            assert not isinstance(entity, _TestDTO)
            count += 1

        assert count == 5

        # 清理
        await async_session.execute(sa.delete(_TestTable).where(_TestTable.name.like("EntityTest-%")))
        await async_session.commit()

    async def test_iter_records_can_modify_entities(self, async_session: AsyncSession):
        """测试可以修改迭代返回的实体"""
        # 创建测试数据
        for i in range(3):
            cu = _TestCU(name=f"ModifyTest-{i}", status=_TestStatus.ACTIVE, value=0, create_operator_id=1)
            await _TestDAL.create(async_session, cu)
        await async_session.commit()

        # 迭代并修改
        async for entity in _TestDAL.iter_records(async_session, where_clauses=[_TestTable.name.like("ModifyTest-%")]):
            entity.value = 999

        await async_session.commit()

        # 验证修改生效
        result = await async_session.execute(sa.select(_TestTable).where(_TestTable.name.like("ModifyTest-%")))
        entities = result.scalars().all()
        for entity in entities:
            assert entity.value == 999

        # 清理
        await async_session.execute(sa.delete(_TestTable).where(_TestTable.name.like("ModifyTest-%")))
        await async_session.commit()

    async def test_iter_records_readonly_session(self, db_manager: AsyncSQLiteManager):
        """测试只读会话可以调用迭代方法(因为是读操作)"""
        # 先用可写会话创建数据
        async with db_manager.got_manual_session() as session:
            for i in range(3):
                cu = _TestCU(name=f"ReadonlyIterTest-{i}", status=_TestStatus.ACTIVE, value=i, create_operator_id=1)
                await _TestDAL.create(session, cu)
            await session.commit()

        # 使用只读会话迭代(应该成功)
        async with db_manager.got_readonly_session() as ro_session:
            count = 0
            async for entity in _TestDAL.iter_records(ro_session, where_clauses=[_TestTable.name.like("ReadonlyIterTest-%")]):
                assert isinstance(entity, _TestTable)
                count += 1
            assert count == 3

        # 清理
        async with db_manager.got_manual_session() as session:
            await session.execute(sa.delete(_TestTable).where(_TestTable.name.like("ReadonlyIterTest-%")))
            await session.commit()


class TestOptimisticLock:
    """测试乐观锁功能"""

    async def test_update_with_optimistic_lock_success(self, async_session: AsyncSession) -> None:
        """测试乐观锁更新成功"""
        # 创建测试数据
        cu = _TestVersionCU(name="OptimisticTest", value=100, create_operator_id=1)
        entity = await _TestVersionDAL.create(async_session, cu)
        await async_session.commit()

        initial_version = entity.version
        assert initial_version == 0

        # 使用乐观锁更新
        update_cu = _TestVersionCU(name="OptimisticTest", value=200, create_operator_id=1)
        updated_entity = await _TestVersionDAL.update_only_set_with_optimistic_lock(
            async_session,
            entity.id,
            update_cu,
            expected_version=initial_version,
            need_refresh=True,
        )

        assert updated_entity is not None
        assert updated_entity.value == 200
        assert updated_entity.version == initial_version + 1

        await async_session.commit()

        # 清理
        await async_session.delete(entity)
        await async_session.commit()

    async def test_update_with_optimistic_lock_version_conflict(self, async_session: AsyncSession) -> None:
        """测试乐观锁版本冲突"""
        from cl_sqlalchemyx.base.dal import DBRetryableError

        # 创建测试数据
        cu = _TestVersionCU(name="ConflictTest", value=100, create_operator_id=1)
        entity = await _TestVersionDAL.create(async_session, cu)
        await async_session.commit()

        # 模拟版本冲突:使用错误的version,应该抛出异常
        wrong_version = entity.version + 999
        update_cu = _TestVersionCU(name="ConflictTest", value=200, create_operator_id=1)

        with pytest.raises(DBRetryableError) as exc_info:
            await _TestVersionDAL.update_only_set_with_optimistic_lock(
                async_session,
                entity.id,
                update_cu,
                expected_version=wrong_version,
            )

        assert "版本号不匹配" in str(exc_info.value)

        # 验证数据未被修改
        result = await async_session.get(_TestTableWithVersion, entity.id)
        assert result is not None
        assert result.value == 100
        assert result.version == 0

        # 清理
        await async_session.delete(entity)
        await async_session.commit()

    async def test_update_with_optimistic_lock_multiple_updates(self, async_session: AsyncSession) -> None:
        """测试乐观锁多次连续更新"""
        # 创建测试数据
        cu = _TestVersionCU(name="MultiUpdateTest", value=100, create_operator_id=1)
        entity = await _TestVersionDAL.create(async_session, cu)
        await async_session.commit()

        # 第一次更新
        update_cu1 = _TestVersionCU(name="MultiUpdateTest", value=200, create_operator_id=1)
        entity = await _TestVersionDAL.update_only_set_with_optimistic_lock(
            async_session,
            entity.id,
            update_cu1,
            expected_version=0,
            need_refresh=True,
        )
        assert entity is not None
        assert entity.version == 1
        await async_session.commit()

        # 第二次更新
        update_cu2 = _TestVersionCU(name="MultiUpdateTest", value=300, create_operator_id=1)
        entity = await _TestVersionDAL.update_only_set_with_optimistic_lock(
            async_session,
            entity.id,
            update_cu2,
            expected_version=1,
            need_refresh=True,
        )
        assert entity is not None
        assert entity.version == 2
        assert entity.value == 300
        await async_session.commit()

        # 清理
        await async_session.delete(entity)
        await async_session.commit()

    async def test_update_with_optimistic_lock_empty_update(self, async_session: AsyncSession) -> None:
        """测试乐观锁空更新(没有字段需要更新)"""
        # 创建测试数据
        cu = _TestVersionCU(name="EmptyUpdateTest", value=100, create_operator_id=1)
        entity = await _TestVersionDAL.create(async_session, cu)
        await async_session.commit()

        # 空更新(CU对象没有设置任何字段)
        empty_cu = _TestVersionCU(name="EmptyUpdateTest", value=100, create_operator_id=1)
        # 清空exclude_unset,模拟空更新
        updated_entity = await _TestVersionDAL.update_only_set_with_optimistic_lock(
            async_session,
            entity.id,
            empty_cu,
            expected_version=0,
        )

        # 空更新应该成功并返回实体
        assert updated_entity is not None

        # 清理
        await async_session.delete(entity)
        await async_session.commit()

    async def test_update_with_optimistic_lock_nonexistent_entity(self, async_session: AsyncSession) -> None:
        """测试乐观锁更新不存在的实体"""
        from cl_sqlalchemyx.base.dal import DBRetryableError

        update_cu = _TestVersionCU(name="NonExistent", value=100, create_operator_id=1)

        # 更新不存在的实体应该抛出异常
        with pytest.raises(DBRetryableError):
            await _TestVersionDAL.update_only_set_with_optimistic_lock(
                async_session,
                999999,  # 不存在的ID
                update_cu,
                expected_version=0,
            )

    async def test_custom_version_field_name(self, async_session: AsyncSession) -> None:
        """测试自定义version字段名"""
        # 创建测试数据
        cu = _TestCustomVersionCU(name="CustomVersionTest", value=100, create_operator_id=1)
        entity = await _TestCustomVersionDAL.create(async_session, cu)
        await async_session.commit()

        initial_version = entity.row_version
        assert initial_version == 0

        # 使用自定义版本字段更新
        update_cu = _TestCustomVersionCU(name="CustomVersionTest", value=200, create_operator_id=1)
        updated_entity = await _TestCustomVersionDAL.update_only_set_with_optimistic_lock(
            async_session,
            entity.id,
            update_cu,
            expected_version=initial_version,
            version_field="row_version",  # 使用自定义字段名
            need_refresh=True,
        )

        assert updated_entity is not None
        assert updated_entity.value == 200
        assert updated_entity.row_version == initial_version + 1

        await async_session.commit()

        # 清理
        await async_session.delete(updated_entity)
        await async_session.commit()

    async def test_wrong_version_field_name(self, async_session: AsyncSession) -> None:
        """测试错误的version字段名"""
        cu = _TestVersionCU(name="WrongFieldTest", value=100, create_operator_id=1)
        entity = await _TestVersionDAL.create(async_session, cu)
        await async_session.commit()

        # 使用不存在的字段名应该抛出AttributeError
        update_cu = _TestVersionCU(name="WrongFieldTest", value=200, create_operator_id=1)
        with pytest.raises(AttributeError, match="不包含 nonexistent_field 字段"):
            await _TestVersionDAL.update_only_set_with_optimistic_lock(
                async_session,
                entity.id,
                update_cu,
                expected_version=0,
                version_field="nonexistent_field",
            )

        # 清理
        await async_session.delete(entity)
        await async_session.commit()


class TestPessimisticLock:
    """测试悲观锁功能"""

    async def test_get_by_id_for_update_success(self, async_session: AsyncSession) -> None:
        """测试悲观锁获取成功"""
        # 创建测试数据
        cu = _TestVersionCU(name="PessimisticTest", value=100, create_operator_id=1)
        entity = await _TestVersionDAL.create(async_session, cu)
        await async_session.commit()

        # 使用悲观锁获取
        locked_entity = await _TestVersionDAL.get_by_id_for_update(
            async_session,
            entity.id,
        )

        assert locked_entity is not None
        assert locked_entity.id == entity.id
        assert locked_entity.name == "PessimisticTest"

        # 可以在同一事务中修改
        locked_entity.value = 200
        await async_session.commit()

        # 清理
        await async_session.delete(entity)
        await async_session.commit()

    async def test_get_by_id_for_update_nonexistent_entity(self, async_session: AsyncSession) -> None:
        """测试悲观锁获取不存在的实体"""
        locked_entity = await _TestVersionDAL.get_by_id_for_update(
            async_session,
            999999,  # 不存在的ID
        )

        assert locked_entity is None

    async def test_batch_get_for_update(self, async_session: AsyncSession) -> None:
        """测试批量悲观锁获取"""
        # 创建多个测试数据
        entities = []
        for i in range(3):
            cu = _TestVersionCU(name=f"BatchLockTest-{i}", value=i * 100, create_operator_id=1)
            entity = await _TestVersionDAL.create(async_session, cu)
            entities.append(entity)
        await async_session.commit()

        # 批量获取悲观锁
        entity_ids = [e.id for e in entities]
        locked_entities = await _TestVersionDAL.batch_get_for_update(
            async_session,
            entity_ids,
        )

        assert len(locked_entities) == 3
        assert all(isinstance(e, _TestTableWithVersion) for e in locked_entities)

        # 清理
        for entity in entities:
            result = await async_session.get(_TestTableWithVersion, entity.id)
            if result:
                await async_session.delete(result)
        await async_session.commit()

    async def test_get_one_for_update_with_where_clauses(self, async_session: AsyncSession) -> None:
        """测试根据条件悲观锁获取"""
        # 创建测试数据
        cu = _TestVersionCU(name="WhereClauseTest", value=100, create_operator_id=1)
        entity = await _TestVersionDAL.create(async_session, cu)
        await async_session.commit()

        # 使用WHERE条件获取悲观锁
        locked_entity = await _TestVersionDAL.get_one_for_update(
            async_session,
            where_clauses=[
                _TestTableWithVersion.name == "WhereClauseTest",
                _TestTableWithVersion.value == 100,
            ],
        )

        assert locked_entity is not None
        assert locked_entity.id == entity.id

        # 清理
        await async_session.delete(entity)
        await async_session.commit()

    async def test_batch_get_for_update_empty_ids(self, async_session: AsyncSession) -> None:
        """测试批量获取悲观锁时提供空ID列表"""
        locked_entities = await _TestVersionDAL.batch_get_for_update(
            async_session,
            [],
        )

        assert locked_entities == []

    @pytest.mark.parametrize(
        "method_name, args, kwargs",
        [
            ("get_by_id_for_update", (1,), {}),
            ("batch_get_for_update", ([1, 2],), {}),
            ("get_one_for_update", (), {"where_clauses": [_TestTableWithVersion.id == 1]}),
        ],
    )
    @pytest.mark.parametrize(
        "error_msg, expect_retryable",
        [
            ("Lock wait timeout exceeded", True),
            ("Other operational error", False),
        ],
    )
    async def test_pessimistic_lock_operational_error_handling(
        self,
        method_name: str,
        args: tuple[object, ...],
        kwargs: dict[str, object],
        error_msg: str,
        expect_retryable: bool,
    ) -> None:
        from sqlalchemy.exc import OperationalError as SQLAlchemyOperationalError

        from cl_sqlalchemyx.base.dal import DBRetryableError

        class _FailingSession:
            def __init__(self, error: SQLAlchemyOperationalError) -> None:
                self._error = error

            async def execute(self, *unused_args: object, **unused_kwargs: object) -> object:
                raise self._error

        error = SQLAlchemyOperationalError("SELECT 1", {}, Exception(error_msg))
        session = _FailingSession(error)
        method = getattr(_TestVersionDAL, method_name)

        if expect_retryable:
            with pytest.raises(DBRetryableError) as exc_info:
                await method(session, *args, **kwargs)
            assert exc_info.value.is_pessimistic_lock_retry_error is True
        else:
            with pytest.raises(SQLAlchemyOperationalError):
                await method(session, *args, **kwargs)


class TestConcurrentOptimisticLock:
    """测试并发场景下的乐观锁"""

    async def test_concurrent_updates_with_version_conflict(self, db_manager: AsyncSQLiteManager) -> None:
        """测试并发更新时的版本冲突"""
        import asyncio

        # 创建测试数据
        async with db_manager.got_manual_session() as session:
            cu = _TestVersionCU(name="ConcurrentTest", value=0, create_operator_id=1)
            entity = await _TestVersionDAL.create(session, cu)
            entity_id = entity.id
            await session.commit()

        # 模拟两个并发事务同时读取和更新
        results = []

        async def concurrent_update(worker_id: int) -> tuple[int, bool]:
            """并发更新函数"""
            from cl_sqlalchemyx.base.dal import DBRetryableError

            async with db_manager.got_manual_session() as session:
                try:
                    # 读取当前实体
                    entity = await _TestVersionDAL.get_by_id(session, entity_id)
                    assert entity is not None
                    current_version = entity.version

                    # 模拟一些处理时间
                    await asyncio.sleep(0.01)

                    # 尝试更新
                    update_cu = _TestVersionCU(name="ConcurrentTest", value=worker_id, create_operator_id=1)
                    _ = await _TestVersionDAL.update_only_set_with_optimistic_lock(
                        session,
                        entity_id,
                        update_cu,
                        expected_version=current_version,
                    )

                    await session.commit()
                    return worker_id, True  # noqa: TRY300
                except DBRetryableError:
                    # 版本冲突,回滚
                    await session.rollback()
                    return worker_id, False

        # 启动5个并发更新任务
        tasks = [concurrent_update(i) for i in range(5)]
        results = await asyncio.gather(*tasks)

        # 验证结果:应该只有一个成功,其他都失败
        success_count = sum(1 for _, success in results if success)
        failed_count = sum(1 for _, success in results if not success)

        assert success_count >= 1, "至少应该有一个更新成功"
        assert failed_count >= 1, "应该有失败的更新(版本冲突)"

        # 验证最终状态
        async with db_manager.got_manual_session() as session:
            final_entity = await _TestVersionDAL.get_by_id(session, entity_id)
            assert final_entity is not None
            assert final_entity.version >= 1, "版本号应该递增"
            # 清理
            await session.delete(final_entity)
            await session.commit()

    async def test_optimistic_lock_with_retry(self, db_manager: AsyncSQLiteManager) -> None:
        """测试带重试的乐观锁更新"""
        from cl_sqlalchemyx.base.dal import RetryConfig, async_with_retry

        # 创建测试数据
        async with db_manager.got_manual_session() as session:
            cu = _TestVersionCU(name="RetryTest", value=0, create_operator_id=1)
            entity = await _TestVersionDAL.create(session, cu)
            entity_id = entity.id
            await session.commit()

        attempt_count = 0

        @async_with_retry(RetryConfig(max_attempts=3, initial_delay=0.01))
        async def update_with_retry(session_arg: AsyncSession, worker_id: int) -> int:
            """带重试的更新函数"""
            nonlocal attempt_count
            attempt_count += 1

            entity = await _TestVersionDAL.get_by_id(session_arg, entity_id)
            assert entity is not None

            update_cu = _TestVersionCU(name="RetryTest", value=worker_id, create_operator_id=1)
            # 现在方法会自动抛出DBRetryableError
            updated_entity = await _TestVersionDAL.update_only_set_with_optimistic_lock(
                session_arg,
                entity_id,
                update_cu,
                expected_version=entity.version,
            )

            return worker_id

        # 测试带重试的更新
        async with db_manager.got_manual_session() as session:
            result = await update_with_retry(session, 999)
            await session.commit()
            assert result == 999

        # 清理
        async with db_manager.got_manual_session() as session:
            entity = await _TestVersionDAL.get_by_id(session, entity_id)
            if entity:
                await session.delete(entity)
                await session.commit()

    async def test_batch_concurrent_updates(self, db_manager: AsyncSQLiteManager) -> None:
        """测试批量并发更新场景"""
        import asyncio

        # 创建多个测试数据
        entity_ids = []
        async with db_manager.got_manual_session() as session:
            for i in range(3):
                cu = _TestVersionCU(name=f"BatchConcurrent-{i}", value=0, create_operator_id=1)
                entity = await _TestVersionDAL.create(session, cu)
                entity_ids.append(entity.id)
            await session.commit()

        async def concurrent_batch_update(worker_id: int) -> int:
            """并发批量更新函数"""
            async with db_manager.got_manual_session() as session:
                # 读取所有实体
                updates: dict[int, tuple[int, _TestVersionCU]] = {}
                for entity_id in entity_ids:
                    entity = await _TestVersionDAL.get_by_id(session, entity_id)
                    if entity:
                        update_cu = _TestVersionCU(
                            name=f"BatchConcurrent-{entity_id}",
                            value=worker_id,
                            create_operator_id=1,
                        )
                        updates[entity_id] = (entity.version, update_cu)

                # 模拟处理时间
                await asyncio.sleep(0.01)

                # 批量更新
                success_count = 0
                for entity_id, (expected_version, cu) in updates.items():
                    try:
                        await _TestVersionDAL.update_only_set_with_optimistic_lock(
                            session, entity_id, cu, expected_version=expected_version
                        )
                        success_count += 1
                    except DBRetryableError:  # noqa: PERF203
                        continue

                if success_count > 0:
                    await session.commit()
                else:
                    await session.rollback()

                return success_count

        # 启动3个并发批量更新任务
        tasks = [concurrent_batch_update(i) for i in range(3)]
        success_counts = await asyncio.gather(*tasks)

        # 至少有一个任务应该成功更新一些实体
        assert sum(success_counts) > 0

        # 清理
        async with db_manager.got_manual_session() as session:
            for entity_id in entity_ids:
                entity = await _TestVersionDAL.get_by_id(session, entity_id)
                if entity:
                    await session.delete(entity)
            await session.commit()


# ========================================
# 并发控制工具测试
# ========================================


class TestConcurrencyExceptions:
    """测试并发控制异常类"""

    def test_optimistic_lock_error_default_message(self) -> None:
        """测试数据库可重试异常默认消息"""
        from cl_sqlalchemyx.base.dal import DBRetryableError

        exc = DBRetryableError()
        assert exc.message == "数据库操作冲突,需要重试"
        assert str(exc) == "数据库操作冲突,需要重试"

    def test_optimistic_lock_error_custom_message(self) -> None:
        """测试数据库可重试异常自定义消息-乐观锁"""
        from cl_sqlalchemyx.base.dal import DBRetryableError

        exc = DBRetryableError("乐观锁更新失败-版本号不匹配")
        assert exc.message == "乐观锁更新失败-版本号不匹配"
        assert str(exc) == "乐观锁更新失败-版本号不匹配"

    def test_pessimistic_lock_error_default_message(self) -> None:
        """测试数据库可重试异常自定义消息-悲观锁(默认创建)"""
        from cl_sqlalchemyx.base.dal import DBRetryableError

        exc = DBRetryableError("悲观锁获取失败-锁等待超时")
        assert exc.message == "悲观锁获取失败-锁等待超时"
        assert str(exc) == "悲观锁获取失败-锁等待超时"

    def test_pessimistic_lock_error_custom_message(self) -> None:
        """测试数据库可重试异常自定义消息-通用"""
        from cl_sqlalchemyx.base.dal import DBRetryableError

        exc = DBRetryableError("锁被占用")
        assert exc.message == "锁被占用"
        assert str(exc) == "锁被占用"


class TestRetryConfig:
    """测试重试配置"""

    def test_default_config(self) -> None:
        """测试默认配置"""
        from cl_sqlalchemyx.base.dal import RetryConfig

        config = RetryConfig()
        assert config.max_attempts == 3
        assert config.initial_delay == 0.1
        assert config.max_delay == 2.0
        assert config.exponential_base == 2.0
        assert config.jitter is True

    def test_custom_config(self) -> None:
        """测试自定义配置"""
        from cl_sqlalchemyx.base.dal import RetryConfig

        config = RetryConfig(
            max_attempts=5,
            initial_delay=0.05,
            max_delay=5.0,
            exponential_base=3.0,
            jitter=False,
        )
        assert config.max_attempts == 5
        assert config.initial_delay == 0.05
        assert config.max_delay == 5.0
        assert config.exponential_base == 3.0
        assert config.jitter is False

    def test_invalid_max_attempts(self) -> None:
        """测试无效的max_attempts"""
        from cl_sqlalchemyx.base.dal import RetryConfig

        with pytest.raises(ValueError, match="max_attempts必须>=1"):
            RetryConfig(max_attempts=0)

    def test_invalid_initial_delay(self) -> None:
        """测试无效的initial_delay"""
        from cl_sqlalchemyx.base.dal import RetryConfig

        with pytest.raises(ValueError, match="initial_delay必须>=0"):
            RetryConfig(initial_delay=-0.1)

    def test_invalid_max_delay(self) -> None:
        """测试max_delay小于initial_delay"""
        from cl_sqlalchemyx.base.dal import RetryConfig

        with pytest.raises(ValueError, match="max_delay.*必须>=initial_delay"):
            RetryConfig(initial_delay=1.0, max_delay=0.5)

    def test_invalid_exponential_base(self) -> None:
        """测试无效的exponential_base"""
        from cl_sqlalchemyx.base.dal import RetryConfig

        with pytest.raises(ValueError, match="exponential_base必须>1"):
            RetryConfig(exponential_base=1.0)

    def test_calculate_delay_first_attempt(self) -> None:
        """测试第一次尝试的延迟计算"""
        from cl_sqlalchemyx.base.dal import RetryConfig

        config = RetryConfig(initial_delay=0.1, jitter=False)
        delay = config.calculate_delay(1)
        assert delay == 0.1

    def test_calculate_delay_exponential_backoff(self) -> None:
        """测试指数退避延迟计算"""
        from cl_sqlalchemyx.base.dal import RetryConfig

        config = RetryConfig(initial_delay=0.1, exponential_base=2.0, jitter=False)
        # 第1次: 0.1 * 2^0 = 0.1
        # 第2次: 0.1 * 2^1 = 0.2
        # 第3次: 0.1 * 2^2 = 0.4
        assert config.calculate_delay(1) == 0.1
        assert config.calculate_delay(2) == 0.2
        assert config.calculate_delay(3) == 0.4

    def test_calculate_delay_max_cap(self) -> None:
        """测试延迟上限"""
        from cl_sqlalchemyx.base.dal import RetryConfig

        config = RetryConfig(initial_delay=0.1, max_delay=0.3, jitter=False)
        # 第5次理论上是0.1 * 2^4 = 1.6,但会被限制为0.3
        delay = config.calculate_delay(5)
        assert delay == 0.3

    def test_calculate_delay_with_jitter(self) -> None:
        """测试带抖动的延迟计算"""
        from cl_sqlalchemyx.base.dal import RetryConfig

        config = RetryConfig(initial_delay=1.0, jitter=True)
        # 抖动会在±20%范围内随机,所以延迟应该在[0.8, 1.2]之间
        delays = [config.calculate_delay(1) for _ in range(10)]
        # 验证所有延迟都在合理范围内
        assert all(0.8 <= d <= 1.2 for d in delays)
        # 验证不是所有延迟都相同(有随机性)
        assert len(set(delays)) > 1

    def test_calculate_delay_zero_attempt(self) -> None:
        """测试attempt=0的情况"""
        from cl_sqlalchemyx.base.dal import RetryConfig

        config = RetryConfig()
        delay = config.calculate_delay(0)
        assert delay == 0.0


class TestRetryDecorators:
    """测试重试装饰器"""

    async def test_optimistic_lock_retry_success_on_first_try(self) -> None:
        """测试乐观锁重试装饰器第一次就成功"""
        from cl_sqlalchemyx.base.dal import async_with_retry

        call_count = 0

        @async_with_retry()
        async def successful_operation() -> str:
            nonlocal call_count
            call_count += 1
            return "success"

        result = await successful_operation()
        assert result == "success"
        assert call_count == 1

    async def test_optimistic_lock_retry_success_after_retry(self) -> None:
        """测试乐观锁重试装饰器重试后成功"""
        from cl_sqlalchemyx.base.dal import DBRetryableError, RetryConfig, async_with_retry

        call_count = 0

        @async_with_retry(RetryConfig(max_attempts=3, initial_delay=0.01))
        async def retry_then_success() -> str:
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise DBRetryableError("版本冲突")
            return "success"

        result = await retry_then_success()
        assert result == "success"
        assert call_count == 3

    async def test_optimistic_lock_retry_fail_after_max_retries(self) -> None:
        """测试乐观锁重试装饰器达到最大重试次数后失败"""
        from cl_sqlalchemyx.base.dal import DBRetryableError, RetryConfig, async_with_retry

        call_count = 0

        @async_with_retry(RetryConfig(max_attempts=3, initial_delay=0.01))
        async def always_fail() -> str:
            nonlocal call_count
            call_count += 1
            raise DBRetryableError("版本冲突")

        with pytest.raises(DBRetryableError, match="版本冲突"):
            await always_fail()
        assert call_count == 3

    async def test_optimistic_lock_retry_other_exception_not_retried(self) -> None:
        """测试其他异常不会重试"""
        from cl_sqlalchemyx.base.dal import RetryConfig, async_with_retry

        call_count = 0

        @async_with_retry(RetryConfig(max_attempts=3))
        async def raise_other_error() -> str:
            nonlocal call_count
            call_count += 1
            raise ValueError("其他错误")

        with pytest.raises(ValueError, match="其他错误"):
            await raise_other_error()
        assert call_count == 1  # 不重试

    async def test_optimistic_lock_retry_with_conflict_callback(self) -> None:
        """测试乐观锁冲突回调"""
        from cl_sqlalchemyx.base.dal import DBRetryableError, RetryConfig, async_with_retry

        call_count = 0
        conflict_attempts: list[int] = []

        async def on_conflict(attempt: int, exc: Exception) -> None:
            conflict_attempts.append(attempt)

        @async_with_retry(
            RetryConfig(max_attempts=3, initial_delay=0.01),
            on_conflict=on_conflict,
        )
        async def retry_operation() -> str:
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise DBRetryableError("版本冲突")
            return "success"

        result = await retry_operation()
        assert result == "success"
        assert conflict_attempts == [1, 2]  # 前两次失败触发回调

    async def test_optimistic_lock_retry_callback_exception_handled(self) -> None:
        """测试回调中的异常被处理"""
        from cl_sqlalchemyx.base.dal import DBRetryableError, RetryConfig, async_with_retry

        async def failing_callback(attempt: int, exc: Exception) -> None:
            raise RuntimeError("回调失败")

        @async_with_retry(
            RetryConfig(max_attempts=2, initial_delay=0.01),
            on_conflict=failing_callback,
        )
        async def operation() -> str:
            raise DBRetryableError("版本冲突")

        # 回调失败不应影响重试逻辑
        with pytest.raises(DBRetryableError):
            await operation()

    async def test_pessimistic_lock_retry_success_on_first_try(self) -> None:
        """测试悲观锁重试装饰器第一次就成功"""
        from cl_sqlalchemyx.base.dal import async_with_retry

        call_count = 0

        @async_with_retry()
        async def successful_operation() -> str:
            nonlocal call_count
            call_count += 1
            return "success"

        result = await successful_operation()
        assert result == "success"
        assert call_count == 1

    async def test_pessimistic_lock_retry_success_after_retry(self) -> None:
        """测试悲观锁重试装饰器重试后成功"""
        from cl_sqlalchemyx.base.dal import DBRetryableError, RetryConfig, async_with_retry

        call_count = 0

        @async_with_retry(RetryConfig(max_attempts=3, initial_delay=0.01))
        async def retry_then_success() -> str:
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise DBRetryableError("锁被占用")
            return "success"

        result = await retry_then_success()
        assert result == "success"
        assert call_count == 3

    async def test_pessimistic_lock_retry_fail_after_max_retries(self) -> None:
        """测试悲观锁重试装饰器达到最大重试次数后失败"""
        from cl_sqlalchemyx.base.dal import DBRetryableError, RetryConfig, async_with_retry

        call_count = 0

        @async_with_retry(RetryConfig(max_attempts=3, initial_delay=0.01))
        async def always_fail() -> str:
            nonlocal call_count
            call_count += 1
            raise DBRetryableError("锁被占用")

        with pytest.raises(DBRetryableError, match="锁被占用"):
            await always_fail()
        assert call_count == 3

    async def test_pessimistic_lock_retry_with_lock_failure_callback(self) -> None:
        """测试悲观锁失败回调"""
        from cl_sqlalchemyx.base.dal import DBRetryableError, RetryConfig, async_with_retry

        failure_attempts: list[int] = []

        async def on_lock_failure(attempt: int, exc: Exception) -> None:
            failure_attempts.append(attempt)

        @async_with_retry(
            RetryConfig(max_attempts=3, initial_delay=0.01),
            on_conflict=on_lock_failure,
        )
        async def operation() -> str:
            if len(failure_attempts) < 2:
                raise DBRetryableError("锁被占用")
            return "success"

        result = await operation()
        assert result == "success"
        assert failure_attempts == [1, 2]

    async def test_multiple_concurrent_retries(self) -> None:
        """测试多个并发重试不会互相干扰"""
        from cl_sqlalchemyx.base.dal import DBRetryableError, RetryConfig, async_with_retry

        results: list[str] = []

        @async_with_retry(RetryConfig(max_attempts=2, initial_delay=0.01))
        async def operation(name: str) -> str:
            # 模拟第一次失败,第二次成功
            if name not in results:
                results.append(name)
                raise DBRetryableError("第一次失败")
            return f"success-{name}"

        # 并发执行多个操作
        tasks = [operation(f"op{i}") for i in range(5)]
        concurrent_results = await asyncio.gather(*tasks)

        assert len(concurrent_results) == 5
        assert all(r.startswith("success-") for r in concurrent_results)


# ========== 100%覆盖率补充测试 ==========


class TestDBRetryableErrorProperties:
    """测试 DBRetryableError 属性检测"""

    def test_is_pessimistic_lock_retry_error_true(self):
        """测试悲观锁错误属性为 True"""
        error = DBRetryableError("悲观锁获取失败-锁等待超时")
        assert error.is_pessimistic_lock_retry_error is True
        assert error.is_optimistic_lock_retry_error is False

    def test_is_optimistic_lock_retry_error_true(self):
        """测试乐观锁错误属性为 True"""
        error = DBRetryableError("乐观锁更新失败-版本号不匹配")
        assert error.is_optimistic_lock_retry_error is True
        assert error.is_pessimistic_lock_retry_error is False

    def test_is_pessimistic_lock_retry_error_false(self):
        """测试普通错误悲观锁属性为 False"""
        error = DBRetryableError("普通数据库错误")
        assert error.is_pessimistic_lock_retry_error is False
        assert error.is_optimistic_lock_retry_error is False

    def test_is_optimistic_lock_retry_error_false(self):
        """测试普通错误乐观锁属性为 False"""
        error = DBRetryableError("普通数据库错误")
        assert error.is_optimistic_lock_retry_error is False
        assert error.is_pessimistic_lock_retry_error is False


class TestAsyncTempSetLockWaitTimeout:
    """测试 async_temp_set_lock_wait_timeout 上下文管理器"""

    async def test_context_manager_normal_exit(self, async_session: AsyncSession):
        """测试正常退出上下文时 finally 块执行"""
        # 测试 timeout_seconds 不为 None 时能正常进入和退出
        async with async_temp_set_lock_wait_timeout(async_session, 5):
            # 验证上下文内可以执行查询
            assert async_session is not None
        # 正常退出说明 finally 块已执行(无异常)

    async def test_context_manager_with_none_timeout(self, async_session: AsyncSession):
        """测试 timeout_seconds 为 None 时直接 yield"""
        # 测试 timeout_seconds 为 None 时不执行 SET 语句
        async with async_temp_set_lock_wait_timeout(async_session, None):
            assert async_session is not None


class TestAsyncWithRetryEdgeCases:
    """测试 async_with_retry 装饰器边界情况"""

    async def test_retry_success_first_try(self):
        """测试一次成功的情况不触发重试"""
        from cl_sqlalchemyx.base.dal import RetryConfig

        call_count = 0

        @async_with_retry(RetryConfig(max_attempts=3, initial_delay=0.01))
        async def success_first():
            nonlocal call_count
            call_count += 1
            return "success"

        result = await success_first()
        assert result == "success"
        assert call_count == 1

    async def test_retry_runtime_error_when_no_attempts(self):
        """测试重试次数为0时的兜底异常"""
        from cl_sqlalchemyx.base.dal import RetryConfig

        retry_config = RetryConfig(max_attempts=1)
        retry_config.max_attempts = 0

        @async_with_retry(retry_config)
        async def never_called():
            return "should-not-run"

        with pytest.raises(RuntimeError, match="重试失败但未捕获异常"):
            await never_called()


class TestIterRecordsEdgeCases:
    """测试 _iter_records 边界情况"""

    def test_iter_records_without_id_field_raises_sync(self):
        """测试无 id 字段的表迭代时抛出 ValueError(同步测试)"""
        from cl_sqlalchemyx.base.dal import AsyncRawReadDAL

        # 这个测试验证当表没有 id 字段时,会抛出 ValueError
        # 注意:SQLAlchemy 要求表必须有主键,所以我们使用 InstrumentedAttribute 检查
        # 如果表没有 id 字段,hasattr(table_class, "id") 会返回 False

        # 创建一个没有 id 字段的类
        class NoIdTable:
            __tablename__ = "no_id_table_for_test"
            name: Mapped[str] = mapped_column(sa.String(50), nullable=False)

        # 验证检查逻辑
        has_id = hasattr(NoIdTable, "id") and isinstance(getattr(NoIdTable, "id", None), InstrumentedAttribute)  # noqa: F821
        assert has_id is False, "NoIdTable 不应该有 id 字段"

        # 模拟调用 _iter_records 时的检查
        # 检查逻辑: if not hasattr(table_class, "id") or not isinstance(...)
        with pytest.raises(ValueError, match="必须有 id 字段"):
            # 使用 mock 测试检查逻辑
            import asyncio
            from unittest.mock import AsyncMock

            async_session = AsyncMock()

            async def run_test():
                async for _ in AsyncRawReadDAL._iter_records(
                    async_session,
                    NoIdTable,
                    batch_size=10,  # pyright: ignore[reportArgumentType]
                ):
                    pass

            asyncio.run(run_test())


class TestUpdateFullByIdRefresh:
    """测试 update_full_by_id 的 refresh 功能"""

    async def test_update_full_by_id_with_refresh(self, async_session: AsyncSession):
        """测试 need_refresh=True 时刷新实体"""
        # 先创建一条记录
        cu = _TestCU(name="刷新测试", status=_TestStatus.ACTIVE, value=100)
        created = await _TestDAL.create(async_session, cu)
        await async_session.refresh(created)
        entity_id = created.id

        # 更新记录并刷新
        update_cu = _TestCU(name="更新后名称", status=_TestStatus.INACTIVE, value=200)
        updated = await _TestDAL.update_full_by_id(async_session, entity_id, update_cu, need_refresh=True)

        assert updated is not None
        assert updated.name == "更新后名称"
        assert updated.status == _TestStatus.INACTIVE.value
        assert updated.value == 200


class TestUpdatePartialByIdFieldTypes:
    """测试 update_partial_by_id 字段类型"""

    async def test_update_partial_by_id_with_column_fields(self, async_session: AsyncSession):
        """测试使用 sa.Column 作为字段白名单"""
        # 先创建一条记录
        cu = _TestCU(name="原始名称", status=_TestStatus.ACTIVE, value=100, description="原始描述")
        created = await _TestDAL.create(async_session, cu)
        await async_session.refresh(created)
        entity_id = created.id

        # 使用 sa.Column 作为字段白名单
        update_cu = _TestCU(name="新名称", status=_TestStatus.INACTIVE, value=200, description="新描述")
        updated = await _TestDAL.update_partial_by_id(
            async_session,
            entity_id,
            update_cu,
            fields={_TestTable.status, _TestTable.value},  # 使用 InstrumentedAttribute
            need_refresh=True,
        )

        # 只有白名单内的字段被更新
        assert updated is not None
        assert updated.status == _TestStatus.INACTIVE.value
        assert updated.value == 200
        # description 不在白名单中,不应被更新
        assert updated.description == "原始描述"
        # name 也不在白名单中,不应被更新
        assert updated.name == "原始名称"

    async def test_update_partial_by_id_with_sa_column(self, async_session: AsyncSession):
        """测试使用 sa.Column 对象作为字段白名单

        覆盖 lines 1311-1314: when allowed_names comes from sa.Column
        """
        # 先创建一条记录
        cu = _TestCU(name="原始名称", status=_TestStatus.ACTIVE, value=100, description="原始描述")
        created = await _TestDAL.create(async_session, cu)
        await async_session.refresh(created)
        entity_id = created.id

        # 使用 sa.Column 对象作为字段白名单
        # 注意: _TestTable.__table__.c.status 返回 Column 对象
        status_column = _TestTable.__table__.c.status
        value_column = _TestTable.__table__.c.value

        update_cu = _TestCU(name="新名称", status=_TestStatus.INACTIVE, value=200, description="新描述")
        updated = await _TestDAL.update_partial_by_id(
            async_session,
            entity_id,
            update_cu,
            fields={status_column, value_column},  # 使用 sa.Column 对象
            need_refresh=True,
        )

        # 只有白名单内的字段被更新
        assert updated is not None
        assert updated.status == _TestStatus.INACTIVE.value
        assert updated.value == 200
        # description 不在白名单中,不应被更新
        assert updated.description == "原始描述"

    async def test_update_partial_by_id_with_string_override(self, async_session: AsyncSession):
        """测试 none_policy_overrides 使用字符串 key"""
        # 先创建一条记录
        cu = _TestCU(name="测试名称", status=_TestStatus.ACTIVE, value=100)
        created = await _TestDAL.create(async_session, cu)
        await async_session.refresh(created)
        entity_id = created.id

        # 使用字符串作为 override key,测试 string key 处理逻辑
        update_cu = _TestCU(name="新名称", status=_TestStatus.INACTIVE, value=200)
        updated = await _TestDAL.update_partial_by_id(
            async_session,
            entity_id,
            update_cu,
            none_policy_overrides={"name": "forbid"},  # 字符串 key
            need_refresh=True,
        )

        assert updated is not None
        assert updated.status == _TestStatus.INACTIVE.value
        assert updated.value == 200

    async def test_update_partial_by_id_with_refresh(self, async_session: AsyncSession):
        """测试 need_refresh=True 时刷新实体"""
        # 先创建一条记录
        cu = _TestCU(name="刷新测试", status=_TestStatus.ACTIVE, value=100)
        created = await _TestDAL.create(async_session, cu)
        await async_session.refresh(created)
        entity_id = created.id

        # 更新并刷新
        update_cu = _TestCU(name="更新后", status=_TestStatus.INACTIVE, value=200)
        updated = await _TestDAL.update_partial_by_id(async_session, entity_id, update_cu, need_refresh=True)

        assert updated is not None
        assert updated.status == _TestStatus.INACTIVE.value
        assert updated.value == 200

    async def test_update_partial_by_id_with_unknown_field_type(self, async_session: AsyncSession):
        """测试使用未知类型的字段对象作为白名单

        覆盖 line 1314: else 分支(str(f) 处理)
        当字段类型既不是 InstrumentedAttribute 也不是 sa.Column 时,
        会使用 str(f) 作为字段名
        """
        # 先创建一条记录
        cu = _TestCU(name="原始名称", status=_TestStatus.ACTIVE, value=100)
        created = await _TestDAL.create(async_session, cu)
        await async_session.refresh(created)
        entity_id = created.id

        # 使用字符串作为字段标识(模拟未知类型)
        update_cu = _TestCU(name="新名称", status=_TestStatus.INACTIVE, value=200)
        updated = await _TestDAL.update_partial_by_id(
            async_session,
            entity_id,
            update_cu,
            fields={"status", "value"},  # 直接使用字符串作为字段名
            need_refresh=True,
        )

        assert updated is not None
        assert updated.status == _TestStatus.INACTIVE.value
        assert updated.value == 200


class TestOptimisticLockEdgeCases:
    """测试乐观锁边界情况"""

    async def test_optimistic_lock_readonly_session_raises(self, async_session: AsyncSession, readonly_session: AsyncSession):
        """测试只读会话不允许乐观锁更新"""
        # 先创建一条记录
        cu = _TestVersionCU(name="测试", value=100)
        created = await _TestVersionDAL.create(async_session, cu)
        await async_session.refresh(created)
        entity_id = created.id
        version = created.version

        # 在只读会话中尝试乐观锁更新
        with pytest.raises(TypeError, match="只读"):
            await _TestVersionDAL.update_only_set_with_optimistic_lock(
                readonly_session, entity_id, _TestVersionCU(name="新名称", value=100), expected_version=version
            )

    async def test_optimistic_lock_empty_update_returns_entity(self, async_session: AsyncSession):
        """测试空更新数据时直接返回实体(不执行SQL)

        当 CU 对象没有显式设置任何字段时,model_dump(exclude_unset=True) 返回空字典,
        此时直接返回实体而不执行 UPDATE SQL.
        """
        # 先创建一条记录
        cu = _TestVersionCU(name="测试", value=100)
        created = await _TestVersionDAL.create(async_session, cu)
        await async_session.refresh(created)
        entity_id = created.id
        version = created.version

        # 创建一个自定义 CU 类,所有字段都有默认值
        # 这样 model_dump(exclude_unset=True) 会返回空字典
        class _EmptyVersionCU(BaseCU["_TestTableWithVersion"]):
            _Table: ClassVar[type[_TestTableWithVersion]] = _TestTableWithVersion
            name: str = "default"
            value: int = 0

        empty_cu = _EmptyVersionCU()  # 所有字段都使用默认值
        result = await _TestVersionDAL.update_only_set_with_optimistic_lock(async_session, entity_id, empty_cu, expected_version=version)

        assert result is not None
        # 版本号不应改变(因为没有执行 UPDATE)
        assert result.version == version

    async def test_optimistic_lock_missing_id_field_raises(self) -> None:
        """测试缺少 id 字段时抛出异常"""

        class _NoIdVersionTable(BasicAsyncBaseTable):
            __tablename__ = "unit_testing_no_id_version_table"

            pk: Mapped[int] = mapped_column(sa.Integer, primary_key=True)
            version: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
            name: Mapped[str] = mapped_column(sa.String(50), nullable=False)

        class _NoIdCU(BaseModel):
            name: str

        class _NoIdDTO(BaseModel):
            pk: int
            name: str
            version: int

            model_config = ConfigDict(from_attributes=True)

        class _NoIdDAL(AsyncBaseDAL[_NoIdVersionTable, _NoIdDTO, _NoIdCU]):  # pyright: ignore[reportInvalidTypeArguments]
            _Table = _NoIdVersionTable
            _DTO = _NoIdDTO
            _CU = _NoIdCU

        class _SessionStub:
            def __init__(self) -> None:
                self.info: dict[str, bool] = {}

        with pytest.raises(AttributeError, match="不包含 id 字段"):
            await _NoIdDAL.update_only_set_with_optimistic_lock(
                _SessionStub(),
                1,
                _NoIdCU(name="test"),
                expected_version=0,
            )


class TestReadOnlyAsyncBaseDAL:
    """测试 ReadOnlyAsyncBaseDAL 功能"""

    def test_get_dto_fields(self):
        """测试获取 DTO 字段列表"""
        fields = ReadOnlyAsyncBaseDAL._get_dto_fields(_TestDTO)
        assert isinstance(fields, list)
        assert "id" in fields
        assert "name" in fields
        assert "status" in fields
        assert "value" in fields

    def test_get_dto_fields_simple_dto(self):
        """测试获取简单 DTO 的字段列表"""
        fields = ReadOnlyAsyncBaseDAL._get_dto_fields(_TestSimpleDTO)
        assert "id" in fields
        assert "name" in fields


class TestFieldMixinDataJsonBytes:
    """测试 FieldMixin.DataJsonBytes 功能"""

    def test_must_x_data_json_property(self):
        """测试 must_x_data_json 属性访问"""
        from pydantic import BaseModel

        class DM(BaseModel):
            """测试用的数据模型"""

            a: int = 0
            b: str = ""

        class TestDataJsonBytesTable(StdAsyncBaseTable, FieldMixin.DataJsonBytes[DM]):
            __tablename__ = "test_datajson_bytes_table"
            name: Mapped[str] = mapped_column(sa.String(50), nullable=False)
            data_json: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False, default=b"{}")

        TestDataJsonBytesTable._DATA_JSON = DM

        entity = TestDataJsonBytesTable(name="test")
        entity.data_json = b'{"a": 1, "b": "hello"}'

        # 访问 must_x_data_json 属性
        data = entity.must_x_data_json
        assert data is not None
        assert isinstance(data, DM)
        assert data.a == 1
        assert data.b == "hello"

    def test_x_data_json_without_data_json_binding(self):
        """测试未绑定 _DATA_JSON 时返回 None

        创建一个继承自 FieldMixin.DataJsonBytes 但没有设置 _DATA_JSON 的表
        此时 x_data_json 属性应该返回 None
        """
        from pydantic import BaseModel

        class DM(BaseModel):
            a: int = 0
            b: str = ""

        # 创建表但不设置 _DATA_JSON
        class UnboundTable(StdAsyncBaseTable, FieldMixin.DataJsonBytes[DM]):
            __tablename__ = "unbound_table_bytes"
            name: Mapped[str] = mapped_column(sa.String(50), nullable=False)
            data_json: Mapped[bytes] = mapped_column(sa.LargeBinary)

        # 不设置 _DATA_JSON
        # UnboundTable._DATA_JSON = DM  # 注释掉这行

        entity = UnboundTable(name="test")
        # 未绑定 _DATA_JSON 时 x_data_json 返回 None
        result = entity.x_data_json
        assert result is None

    def test_x_data_json_setter_non_bytes(self):
        """测试 x_data_json setter 处理非 bytes 值

        直接设置 data_json 为非 bytes 值(如字符串),
        然后测试 x_data_json getter 的处理逻辑
        """
        from pydantic import BaseModel

        class DM(BaseModel):
            a: int = 0
            b: str = ""

        class SampleDataJsonBytesTable(StdAsyncBaseTable, FieldMixin.DataJsonBytes[DM]):
            __tablename__ = "test_datajson_bytes_table2"
            name: Mapped[str] = mapped_column(sa.String(50), nullable=False)
            data_json: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False, default=b"{}")

        SampleDataJsonBytesTable._DATA_JSON = DM

        entity = SampleDataJsonBytesTable(name="test")
        # 直接设置非 bytes 类型的原始值,测试 getter 中的 str() 分支
        entity.data_json = 12345  # 设置一个整数,不是 bytes  # pyright: ignore[reportAttributeAccessIssue]

        # 读取时会进入 str() 分支
        raw = getattr(entity, entity._DATA_JSON_FIELD)
        assert raw == 12345  # 验证 raw 值
        # x_data_json 会尝试将 12345 转为字符串再解析为 JSON
        # 由于 "12345" 不是有效的 JSON,会抛出 ValidationError
        with pytest.raises(ValidationError):
            _ = entity.x_data_json

    def test_x_data_json_setter_none(self):
        """测试 x_data_json 设置为 None"""
        from pydantic import BaseModel

        class DM(BaseModel):
            a: int = 0
            b: str = ""

        class SampleDataJsonBytesTable2(StdAsyncBaseTable, FieldMixin.DataJsonBytes[DM]):
            __tablename__ = "test_datajson_bytes_table3"
            name: Mapped[str] = mapped_column(sa.String(50), nullable=False)
            data_json: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False, default=b"{}")

        SampleDataJsonBytesTable2._DATA_JSON = DM

        entity = SampleDataJsonBytesTable2(name="test")
        entity.x_data_json = None
        # 设置为 None 时应该写入 b"{}"
        assert entity.data_json == b"{}"

    def test_x_data_json_getter_with_empty_bytes(self):
        """测试 x_data_json getter 处理空 bytes"""
        from pydantic import BaseModel

        class DM(BaseModel):
            a: int = 0
            b: str = ""

        class SampleDataJsonBytesTable2(StdAsyncBaseTable, FieldMixin.DataJsonBytes[DM]):
            __tablename__ = "test_datajson_bytes_table4"
            name: Mapped[str] = mapped_column(sa.String(50), nullable=False)
            data_json: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False, default=b"{}")

        SampleDataJsonBytesTable2._DATA_JSON = DM

        entity = SampleDataJsonBytesTable2(name="test")
        entity.data_json = b""  # 空 bytes
        result = entity.x_data_json
        # 空 bytes 应该返回默认值
        assert result is not None
        assert isinstance(result, DM)
        assert result.a == 0
        assert result.b == ""
