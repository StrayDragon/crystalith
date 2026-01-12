from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool

from crystalith.app import create_app
from crystalith.config import DatabaseSettings, Settings
from crystalith.db import create_db_manager


@pytest_asyncio.fixture
async def test_client() -> AsyncGenerator[AsyncClient, None]:
    settings = Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))
    manager = create_db_manager(
        settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    app = create_app(settings, db_manager=manager)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await manager.close()


@pytest.mark.asyncio
async def test_openapi_json_endpoint(test_client: AsyncClient) -> None:
    response = await test_client.get("/v1/codev/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    assert "openapi" in schema
    assert "/v1/notebooks" in schema.get("paths", {})

    source_status = schema.get("components", {}).get("schemas", {}).get("SourceStatus", {})
    assert source_status.get("enum") == ["processing", "ready", "failed"]


@pytest.mark.asyncio
async def test_openapi_ui_endpoint(test_client: AsyncClient) -> None:
    response = await test_client.get("/v1/codev/openapi-ui/scalar")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "/v1/codev/openapi.json" in response.text
