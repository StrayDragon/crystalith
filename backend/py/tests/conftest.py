from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from crystalith.shared.db import create_all, create_db_manager
from crystalith.shared.deps import get_chat_provider, get_embedding_provider
from crystalith.shared.ai.interfaces import EmbeddingProvider
from crystalith.shared.vector_storage import InMemoryVectorStore
from crystalith.web.app import create_app


class DummyEmbeddingProvider:
    provider = "test"
    model = "dummy"

    async def embed(self, texts):
        return [[0.0, 0.0, 0.0] for _ in texts]


class DummyChatProvider:
    provider = "test"
    model = "dummy"

    async def chat(self, messages):
        return "Test answer"

    async def chat_stream(self, messages):
        yield "Test answer"


@pytest.fixture
async def app():
    tempdir = tempfile.TemporaryDirectory()
    db_path = Path(tempdir.name) / "test.db"
    manager = create_db_manager(f"sqlite+aiosqlite:///{db_path}")
    await create_all(manager.async_engine)
    vector_store = InMemoryVectorStore()
    app = create_app(db_manager=manager, vector_store=vector_store)
    app.dependency_overrides[get_embedding_provider] = lambda: DummyEmbeddingProvider()  # type: ignore[assignment]
    app.dependency_overrides[get_chat_provider] = lambda: DummyChatProvider()  # type: ignore[assignment]
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
