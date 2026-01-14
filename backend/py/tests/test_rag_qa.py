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
from crystalith.vector_index import InMemoryVectorIndex


class FakeEmbeddingProvider:
    provider = "fake"
    model = "fake"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if len(texts) == 1 and texts[0] == "__empty__":
            return []
        return [[float(len(text)), 0.0, 1.0] for text in texts]


class FakeChatProvider:
    provider = "fake"
    model = "fake"

    async def chat(self, messages) -> str:
        assert messages, "messages must not be empty"
        return "mocked answer"


@pytest_asyncio.fixture
async def test_client() -> AsyncGenerator[AsyncClient, None]:
    settings = Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))
    manager = create_db_manager(
        settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)

    vector_index = InMemoryVectorIndex()
    app = create_app(settings, db_manager=manager, vector_index=vector_index)
    app.dependency_overrides[get_embedding_provider] = lambda: FakeEmbeddingProvider()
    app.dependency_overrides[get_chat_provider] = lambda: FakeChatProvider()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await manager.close()


@pytest.mark.asyncio
async def test_rag_answer_with_citations(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "hello?"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["evidence"] is True
    assert payload["answer"] == "mocked answer"
    assert payload["citations"]
    assert payload["citations"][0]["source_name"] == "note.md"


@pytest.mark.asyncio
async def test_rag_no_evidence(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Empty"})
    notebook_id = created.json()["id"]

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "unknown"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["evidence"] is False
    assert payload["citations"] == []


@pytest.mark.asyncio
async def test_rag_empty_embedding_returns_no_evidence(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "__empty__"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["evidence"] is False
    assert payload["citations"] == []
