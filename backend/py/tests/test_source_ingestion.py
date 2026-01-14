from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool

from crystalith.api.deps import get_embedding_provider
from crystalith.app import create_app
from crystalith.config import DatabaseSettings, Settings
from crystalith.db import create_all, create_db_manager
from crystalith.vector_index import InMemoryVectorIndex


class FakeEmbeddingProvider:
    provider = "fake"
    model = "fake"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [[float(len(text)), 0.0, 1.0] for text in texts]


class FailingEmbeddingProvider:
    provider = "fake"
    model = "fake"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        raise RuntimeError("boom")


@pytest_asyncio.fixture
async def test_client() -> AsyncGenerator[tuple[AsyncClient, InMemoryVectorIndex], None]:
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

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, vector_index
    await manager.close()


@pytest_asyncio.fixture
async def failing_client() -> AsyncGenerator[tuple[AsyncClient, InMemoryVectorIndex], None]:
    settings = Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))
    manager = create_db_manager(
        settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)

    vector_index = InMemoryVectorIndex()
    app = create_app(settings, db_manager=manager, vector_index=vector_index)
    app.dependency_overrides[get_embedding_provider] = lambda: FailingEmbeddingProvider()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, vector_index
    await manager.close()


@pytest.mark.asyncio
async def test_upload_and_delete_source(test_client: tuple[AsyncClient, InMemoryVectorIndex]) -> None:
    client, vector_index = test_client

    created = await client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201
    payload = upload.json()
    assert payload["status"] == "ready"
    assert payload["chunk_count"] >= 1
    assert len(vector_index) == payload["chunk_count"]

    listing = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    source_id = payload["id"]
    deleted = await client.delete(f"/v1/notebooks/{notebook_id}/sources/{source_id}")
    assert deleted.status_code == 204
    assert len(vector_index) == 0


@pytest.mark.asyncio
async def test_upload_failure_marks_source_failed(
    failing_client: tuple[AsyncClient, InMemoryVectorIndex],
) -> None:
    client, vector_index = failing_client

    created = await client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 500

    listing = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert listing.status_code == 200
    payload = listing.json()
    assert len(payload) == 1
    assert payload[0]["status"] == "failed"
    assert payload[0]["chunk_count"] == 0
    assert len(vector_index) == 0
