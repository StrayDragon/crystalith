from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool

from crystalith.app import create_app
from crystalith.config import DatabaseSettings, Settings
from crystalith.db import create_all, create_db_manager


@pytest_asyncio.fixture
async def test_client() -> AsyncGenerator[AsyncClient, None]:
    settings = Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))
    manager = create_db_manager(
        settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)

    app = create_app(settings, db_manager=manager)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await manager.close()


@pytest.mark.asyncio
async def test_session_crud_flow(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    session_create = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={},
    )
    assert session_create.status_code == 201
    session_payload = session_create.json()
    session_id = session_payload["id"]
    assert session_payload["title"] is None

    listing = await test_client.get(f"/v1/notebooks/{notebook_id}/sessions")
    assert listing.status_code == 200
    items = listing.json()
    assert len(items) == 1
    assert items[0]["id"] == session_id

    fetched = await test_client.get(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}"
    )
    assert fetched.status_code == 200
    assert fetched.json()["id"] == session_id

    updated = await test_client.patch(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}",
        json={"title": "Session One"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Session One"

    deleted = await test_client.delete(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}"
    )
    assert deleted.status_code == 204

    missing = await test_client.get(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}"
    )
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_message_create_list_and_delete_session(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    session_create = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={},
    )
    session_id = session_create.json()["id"]

    first = await test_client.post(
        f"/v1/sessions/{session_id}/messages",
        json={"role": "user", "content": "Hi"},
    )
    assert first.status_code == 201

    second = await test_client.post(
        f"/v1/sessions/{session_id}/messages",
        json={
            "role": "assistant",
            "content": "Hello",
            "citations": [
                {
                    "source_id": 1,
                    "source_name": "demo",
                    "chunk_id": 1,
                    "chunk_index": 0,
                    "snippet": "demo snippet",
                    "score": 0.5,
                }
            ],
        },
    )
    assert second.status_code == 201

    listing = await test_client.get(f"/v1/sessions/{session_id}/messages")
    assert listing.status_code == 200
    items = listing.json()
    assert [item["role"] for item in items] == ["user", "assistant"]

    deleted = await test_client.delete(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}"
    )
    assert deleted.status_code == 204

    missing = await test_client.get(f"/v1/sessions/{session_id}/messages")
    assert missing.status_code == 404
