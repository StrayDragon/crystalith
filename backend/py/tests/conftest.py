from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from crystalith.shared.ai.openai_client_manager import get_openai_client_manager
from crystalith.shared.config import Settings
from crystalith.shared.db import create_db_manager
from crystalith.shared.db.migrations import upgrade_head
from crystalith.shared.vector_storage import InMemoryVectorStore
from crystalith.web.app import create_app
from tests._support.settings import make_settings


@pytest.fixture
def disable_ollama_auto_discovery(monkeypatch: pytest.MonkeyPatch) -> None:
    # Mock reason: keep config load tests deterministic and independent of local Ollama availability.
    monkeypatch.setattr("crystalith.shared.config.manager.auto_discover_ollama", lambda _s: 0)


@pytest.fixture
def test_settings() -> Settings:
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


@pytest.fixture
async def app(test_settings: Settings):
    tempdir = tempfile.TemporaryDirectory()
    db_path = Path(tempdir.name) / "test.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    await asyncio.to_thread(upgrade_head, db_url)
    manager = create_db_manager(db_url)
    vector_store = InMemoryVectorStore()
    app = create_app(settings=test_settings, db_manager=manager, vector_store=vector_store)
    # NOTE: httpx.ASGITransport does not run ASGI lifespan events, so we
    # manually perform the essential startup actions that tests depend on.
    app.state.plugins.load_from_entry_points(app.state.settings)
    async with manager.got_manual_session() as session:
        from crystalith.features.templates.service import ensure_builtin_templates

        await ensure_builtin_templates(session)
    yield app
    await manager.close()
    tempdir.cleanup()


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client


@pytest.fixture
async def db_session(app):
    async with app.state.db.got_manual_session() as session:
        yield session


@pytest.fixture(scope="session", autouse=True)
async def _close_openai_clients_after_tests():
    yield
    await get_openai_client_manager().aclose()
