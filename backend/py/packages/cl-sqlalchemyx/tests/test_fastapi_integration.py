from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from contextlib import suppress
from enum import Enum
from typing import Any

import pytest
import pytest_asyncio
import sqlalchemy as sa
from fastapi import Request
from sqlalchemy.pool import NullPool

from cl_sqlalchemyx.base.dal import READONLY_SESSION_FLAG
from cl_sqlalchemyx.integrations.fastapi import DBManagerMapperFastAPIDepends
from cl_sqlalchemyx.mgrs import AsyncSQLiteManager, AsyncSQLiteManagersMapper


class SampleDB(Enum):
    MAIN = "main"
    ANALYTICS = "analytics"


async def _finalize_dependency(generator: AsyncGenerator[Any, Any]) -> None:
    with suppress(StopAsyncIteration):
        await generator.asend(None)


@pytest.fixture(scope="module")
def sqlite_file_dsn(tmp_path_factory: pytest.TempPathFactory) -> str:
    db_dir = tmp_path_factory.mktemp("sqlite")
    db_file = db_dir / "test.db"
    return f"sqlite+aiosqlite:///{db_file}"


@pytest_asyncio.fixture
async def mapper(sqlite_file_dsn: str) -> AsyncGenerator[AsyncSQLiteManagersMapper[SampleDB], None]:
    managers_mapper = AsyncSQLiteManagersMapper(
        default_name=SampleDB.MAIN,
        binds={
            SampleDB.MAIN: sqlite_file_dsn,
            SampleDB.ANALYTICS: sqlite_file_dsn,
        },
        engine_options_default={"poolclass": NullPool},
    )

    try:
        main_manager = managers_mapper.get_manager(SampleDB.MAIN)
        async with main_manager.got_manual_session() as session:
            await session.execute(sa.text("CREATE TABLE IF NOT EXISTS sample (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)"))
            await session.commit()
        yield managers_mapper
    finally:
        await managers_mapper.close()


@pytest_asyncio.fixture
async def fastapi_request(mapper: AsyncSQLiteManagersMapper[SampleDB]) -> Request:
    scope = {"type": "http", "app": None, "headers": []}
    request = Request(scope)
    request.state.db_mgrs_mapper = mapper
    return request


@pytest.mark.asyncio
async def test_get_async_db_managers_mapper(fastapi_request: Request) -> None:
    mapper = await DBManagerMapperFastAPIDepends.get_async_db_managers_mapper(fastapi_request)
    assert isinstance(mapper, AsyncSQLiteManagersMapper)


@pytest.mark.asyncio
async def test_manager_factory_returns_bound_manager(fastapi_request: Request) -> None:
    dependency = DBManagerMapperFastAPIDepends.get_async_db_manager_by_bind_depends_factory(SampleDB.ANALYTICS)
    manager = await dependency(fastapi_request)
    assert isinstance(manager, AsyncSQLiteManager)
    assert manager is fastapi_request.state.db_mgrs_mapper.get_manager(SampleDB.ANALYTICS)


@pytest.mark.asyncio
async def test_manual_session_dependency_yields_manual_session(fastapi_request: Request) -> None:
    dependency = DBManagerMapperFastAPIDepends.get_async_db_manual_session(SampleDB.MAIN)
    session_gen = dependency(fastapi_request)
    session = await session_gen.__anext__()
    try:
        result = await session.execute(sa.text("SELECT 1"))
        assert result.scalar_one() == 1
    finally:
        await _finalize_dependency(session_gen)


@pytest.mark.asyncio
async def test_tx_session_dependency_commits_changes(fastapi_request: Request) -> None:
    dependency = DBManagerMapperFastAPIDepends.get_async_db_tx_session(SampleDB.MAIN)
    session_gen = dependency(fastapi_request)
    session = await session_gen.__anext__()
    new_name = f"tx-{uuid.uuid4()}"
    try:
        await session.execute(sa.text("INSERT INTO sample (name) VALUES (:name)"), {"name": new_name})
    finally:
        await _finalize_dependency(session_gen)

    manual_dep = DBManagerMapperFastAPIDepends.get_async_db_manual_session(SampleDB.MAIN)
    manual_gen = manual_dep(fastapi_request)
    manual_session = await manual_gen.__anext__()
    try:
        result = await manual_session.execute(sa.text("SELECT name FROM sample WHERE name = :name"), {"name": new_name})
        assert result.scalar_one() == new_name
    finally:
        await _finalize_dependency(manual_gen)


@pytest.mark.asyncio
async def test_ro_session_dependency_rolls_back_changes(fastapi_request: Request) -> None:
    dependency = DBManagerMapperFastAPIDepends.get_async_db_ro_session(SampleDB.MAIN)
    session_gen = dependency(fastapi_request)
    session = await session_gen.__anext__()
    new_name = f"ro-{uuid.uuid4()}"
    try:
        await session.execute(sa.text("INSERT INTO sample (name) VALUES (:name)"), {"name": new_name})
        assert session.info.get(READONLY_SESSION_FLAG) is True
    finally:
        await _finalize_dependency(session_gen)

    manual_dep = DBManagerMapperFastAPIDepends.get_async_db_manual_session(SampleDB.MAIN)
    manual_gen = manual_dep(fastapi_request)
    manual_session = await manual_gen.__anext__()
    try:
        result = await manual_session.execute(sa.text("SELECT name FROM sample WHERE name = :name"), {"name": new_name})
        assert result.scalar_one_or_none() is None
    finally:
        await _finalize_dependency(manual_gen)
