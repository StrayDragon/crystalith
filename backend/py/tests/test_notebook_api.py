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
async def test_notebook_crud_flow(test_client: AsyncClient) -> None:
    create = await test_client.post("/v1/notebooks", json={"name": "Research Notes"})
    assert create.status_code == 201
    payload = create.json()
    notebook_id = payload["id"]
    assert payload["name"] == "Research Notes"

    listing = await test_client.get("/v1/notebooks")
    assert listing.status_code == 200
    items = listing.json()
    assert len(items) == 1
    assert items[0]["id"] == notebook_id

    renamed = await test_client.patch(
        f"/v1/notebooks/{notebook_id}",
        json={"name": "Updated Notes"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Updated Notes"

    deleted = await test_client.delete(f"/v1/notebooks/{notebook_id}")
    assert deleted.status_code == 204

    missing = await test_client.get(f"/v1/notebooks/{notebook_id}")
    assert missing.status_code == 404
