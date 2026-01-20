from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pydantic_ai import models
from pydantic_ai.models.test import TestModel
from sqlalchemy.pool import StaticPool

from crystalith.agents import suggestions_graph
from crystalith.api.deps import get_embedding_provider
from crystalith.app import create_app
from crystalith.config import DatabaseSettings, Settings
from crystalith.db import create_all, create_db_manager
from crystalith.vector_storage import InMemoryVectorStore


class FakeEmbeddingProvider:
    provider = "fake"
    model = "fake"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [[float(len(text)), 0.0, 1.0] for text in texts]


@pytest.fixture(autouse=True)
def _mock_agent_model(monkeypatch) -> None:
    models.ALLOW_MODEL_REQUESTS = False
    test_model = TestModel()
    monkeypatch.setattr(suggestions_graph, "build_chat_model", lambda _settings: test_model)


@pytest_asyncio.fixture
async def test_client() -> AsyncGenerator[AsyncClient, None]:
    settings = Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))
    manager = create_db_manager(
        settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)

    vector_store = InMemoryVectorStore()
    app = create_app(settings, db_manager=manager, vector_store=vector_store)
    app.dependency_overrides[get_embedding_provider] = lambda: FakeEmbeddingProvider()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await manager.close()


@pytest.mark.asyncio
async def test_notebook_suggestions_classified(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/suggestions",
        json={"count": 3},
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["suggestions"]) == 3
    types = {item["type"] for item in payload["suggestions"]}
    assert types == {"factual", "comparative", "analytical"}
    assert payload["suggestions"][0]["context"]


@pytest.mark.asyncio
async def test_session_suggestions_classified(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    session_create = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={},
    )
    session_id = session_create.json()["id"]

    await test_client.post(
        f"/v1/sessions/{session_id}/messages",
        json={"role": "user", "content": "Explain the topic"},
    )
    await test_client.post(
        f"/v1/sessions/{session_id}/messages",
        json={"role": "assistant", "content": "Sure"},
    )

    response = await test_client.post(
        f"/v1/sessions/{session_id}/suggestions",
        json={"count": 3},
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["suggestions"]) == 3
    assert payload["suggestions"][0]["type"] in {"factual", "comparative", "analytical"}


@pytest.mark.asyncio
async def test_notebook_deep_dive_suggestions(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/suggestions",
        json={"count": 3, "mode": "deep_dive", "seed_question": "Why does it matter?"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["suggestions"]) == 3
    assert {item["type"] for item in payload["suggestions"]} == {"deep_dive"}
