from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool

from crystalith.api.deps import get_chat_provider, get_embedding_provider
from crystalith.app import create_app
from crystalith.config import DatabaseSettings, Settings
from crystalith.db import create_all, create_db_manager
from crystalith.vector_storage import InMemoryVectorStore

from conftest import create_test_models


class FakeEmbeddingProvider:
    provider = "fake"
    model = "fake"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [[float(len(text)), 0.0, 1.0] for text in texts]


class CapturingChatProvider:
    provider = "fake"
    model = "fake"

    def __init__(self) -> None:
        self.last_messages = []

    async def chat(self, messages) -> str:
        self.last_messages = messages
        return "mocked answer"


@pytest_asyncio.fixture
async def test_client() -> AsyncGenerator[tuple[AsyncClient, CapturingChatProvider], None]:
    settings = Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))
    manager = create_db_manager(
        settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)

    vector_store = InMemoryVectorStore()
    app = create_app(settings, db_manager=manager, vector_store=vector_store)
    chat_provider = CapturingChatProvider()
    app.dependency_overrides[get_embedding_provider] = lambda: FakeEmbeddingProvider()
    app.dependency_overrides[get_chat_provider] = lambda: chat_provider

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, chat_provider
    await manager.close()


@pytest.mark.asyncio
async def test_qa_session_history_and_title(test_client: tuple[AsyncClient, CapturingChatProvider]) -> None:
    client, chat_provider = test_client

    created = await client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    session_create = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={},
    )
    session_id = session_create.json()["id"]

    upload = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201

    first = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "First question?", "session_id": session_id},
    )
    assert first.status_code == 200

    session_read = await client.get(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}"
    )
    assert session_read.status_code == 200
    assert session_read.json()["title"].startswith("First question")

    second = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "Follow up", "session_id": session_id},
    )
    assert second.status_code == 200
    assert len(chat_provider.last_messages) == 4
    assert chat_provider.last_messages[1].role == "user"
    assert chat_provider.last_messages[2].role == "assistant"
    assert chat_provider.last_messages[3].role == "user"
