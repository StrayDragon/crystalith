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
from crystalith.tasks import TaskQueue
from crystalith.vector_storage import InMemoryVectorStore

from conftest import create_test_models


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
        system_text = messages[0].content.lower()
        if "json" in system_text:
            return '{"title":"Summary","bullets":["a","b"],"terms":["term"]}'
        if "bullet" in system_text:
            return "- point a\n- point b"
        return "paragraph summary"


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
    task_queue = TaskQueue(
        db_manager=manager,
        settings=settings,
        vector_store=vector_store,
        embedder_factory=lambda _settings: FakeEmbeddingProvider(),
        chat_factory=lambda _settings: FakeChatProvider(),
    )
    app = create_app(
        settings,
        db_manager=manager,
        vector_store=vector_store,
        task_queue=task_queue,
    )
    app.dependency_overrides[get_embedding_provider] = lambda: FakeEmbeddingProvider()
    app.dependency_overrides[get_chat_provider] = lambda: FakeChatProvider()
    await app.state.task_queue.start_worker()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await manager.close()


@pytest.mark.asyncio
async def test_refine_paragraph(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/refine",
        json={"prompt": "summarize", "format": "paragraph"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["format"] == "paragraph"
    assert payload["paragraph"] == "paragraph summary"
    assert payload["evidence"] is True
    assert payload["citations"]


@pytest.mark.asyncio
async def test_refine_structured(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/refine",
        json={"prompt": "summarize", "format": "structured"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["structured"]["title"] == "Summary"
    assert payload["structured"]["bullets"] == ["a", "b"]
    assert payload["structured"]["terms"] == ["term"]


@pytest.mark.asyncio
async def test_refine_no_evidence(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Empty"})
    notebook_id = created.json()["id"]

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/refine",
        json={"prompt": "summarize", "format": "paragraph"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["evidence"] is False
    assert payload["citations"] == []


@pytest.mark.asyncio
async def test_refine_empty_embedding_returns_no_evidence(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/refine",
        json={"prompt": "__empty__", "format": "paragraph"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["evidence"] is False
    assert payload["citations"] == []


@pytest.mark.asyncio
async def test_refine_explicit_chunk_ids_override_search(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201

    seeded = await test_client.post(
        f"/v1/notebooks/{notebook_id}/refine",
        json={"prompt": "summarize", "format": "paragraph"},
    )
    assert seeded.status_code == 200
    seeded_payload = seeded.json()
    assert seeded_payload["citations"]
    chunk_id = seeded_payload["citations"][0]["chunk_id"]

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/refine",
        json={
            "prompt": "x",
            "format": "paragraph",
            "chunk_ids": [chunk_id],
            "min_score": 0.99,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["paragraph"] == "paragraph summary"
    assert payload["evidence"] is True
    assert payload["citations"][0]["chunk_id"] == chunk_id


@pytest.mark.asyncio
async def test_refine_batch_explicit_chunk_ids(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201

    seeded = await test_client.post(
        f"/v1/notebooks/{notebook_id}/refine",
        json={"prompt": "summarize", "format": "paragraph"},
    )
    chunk_id = seeded.json()["citations"][0]["chunk_id"]

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/refine/batch",
        json={
            "prompt": "x",
            "formats": ["paragraph", "bullets", "structured"],
            "chunk_ids": [chunk_id],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["evidence"] is True
    assert payload["citations"][0]["chunk_id"] == chunk_id
    assert set(payload["outputs"].keys()) == {"paragraph", "bullets", "structured"}
