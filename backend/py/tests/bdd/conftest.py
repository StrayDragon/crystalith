"""BDD 测试根 conftest。

pytest-bdd 8.x 不原生支持 async 步骤函数（call_fixture_func 不 await 协程）。
解决方案：步骤函数为同步，通过 session 级 event_loop fixture + run_until_complete() 运行异步操作。
"""
from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from crystalith.shared.config import Settings
from crystalith.shared.db import create_db_manager
from crystalith.shared.db.migrations import upgrade_head
from tests.helpers.vector_store import InMemoryVectorStore
from crystalith.web.app import create_app
from tests._support.settings import make_settings

# NOTE: pytest_plugins is defined in tests/conftest.py (root-level)
# to avoid "non-top-level conftest" error.


@pytest.fixture(scope="session")
def event_loop():
    """Session 级事件循环，所有 BDD 步骤共用。"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def test_settings() -> Settings:
    """测试专用配置（内存缓存 + 内存向量存储，无外部依赖）。"""
    return make_settings(
        {
            "app": {"cors": {"allow_origins": []}},
            "cache": {"provider": "memory"},
            "vector_storage": {"provider": "memory"},
            "models": {
                "defaults": {"chat": "test-chat", "embedding": "test-embed"},
                "available": [
                    {
                        "id": "test-chat",
                        "provider": "test",
                        "model": "test-chat",
                        "display_name": "Test Chat",
                        "roles": ["chat"],
                    },
                    {
                        "id": "test-embed",
                        "provider": "test",
                        "model": "test-embed",
                        "display_name": "Test Embed",
                        "roles": ["embed"],
                    },
                ],
            },
        }
    )


@pytest.fixture(scope="module")
def app(event_loop, test_settings):
    """创建测试用 FastAPI 应用（含 SQLite 迁移 + 内置模板）。"""
    tempdir = tempfile.TemporaryDirectory()
    db_path = Path(tempdir.name) / "test.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    event_loop.run_until_complete(asyncio.to_thread(upgrade_head, db_url))
    manager = create_db_manager(db_url)
    vector_store = InMemoryVectorStore()
    _app = create_app(
        settings=test_settings, db_manager=manager, vector_store=vector_store
    )
    _app.state.plugins.load_from_entry_points(_app.state.settings)
    event_loop.run_until_complete(_ensure_builtin_templates(_app, manager))
    yield _app
    event_loop.run_until_complete(manager.close())
    tempdir.cleanup()


async def _ensure_builtin_templates(app, manager):
    async with manager.got_manual_session() as session:
        from crystalith.features.templates.service import ensure_builtin_templates

        await ensure_builtin_templates(session)


@pytest.fixture(scope="module")
def client(event_loop, app):
    """同步可调用的 HTTP 测试客户端。"""
    transport = ASGITransport(app=app)
    c = event_loop.run_until_complete(
        AsyncClient(transport=transport, base_url="http://test").__aenter__()
    )
    yield c
    event_loop.run_until_complete(c.aclose())


@pytest.fixture
def db_session(event_loop, app):
    """同步可调用的数据库会话。"""
    gen = app.state.db.got_manual_session()
    session = event_loop.run_until_complete(gen.__aenter__())
    yield session
    event_loop.run_until_complete(gen.__aexit__(None, None, None))


@pytest.fixture
def 响应上下文():
    """存储多步骤间共享的 HTTP 响应数据。"""
    return {}


@pytest.fixture
def 资源标识():
    """存储测试过程中创建的资源 ID（笔记本、会话、来源等）。"""
    return {}
