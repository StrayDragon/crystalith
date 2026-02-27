from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from crystalith.shared.config import Settings
from crystalith.shared.db import create_db_manager
from crystalith.shared.db.migrations import upgrade_head
from crystalith.shared.vector_storage import InMemoryVectorStore
from crystalith.web.app import create_app


@pytest.mark.asyncio
async def test_auth_disabled_allows_anonymous_access(client) -> None:
    response = await client.get("/v1/models")
    assert response.status_code == 200


@pytest.fixture
def auth_api_key() -> str:
    return "test-api-key"


@pytest.fixture
async def auth_app(test_settings: Settings, auth_api_key: str):
    settings = test_settings.model_copy(deep=True)
    settings.app.auth.enabled = True
    settings.app.auth.api_key = auth_api_key

    tempdir = tempfile.TemporaryDirectory()
    db_path = Path(tempdir.name) / "test-auth.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    await asyncio.to_thread(upgrade_head, db_url)

    manager = create_db_manager(db_url)
    vector_store = InMemoryVectorStore()
    app = create_app(settings=settings, db_manager=manager, vector_store=vector_store)
    yield app
    await manager.close()
    tempdir.cleanup()


@pytest.fixture
async def auth_client(auth_app):
    transport = ASGITransport(app=auth_app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client


@pytest.mark.asyncio
async def test_auth_enabled_requires_token_for_v1(auth_client: AsyncClient) -> None:
    response = await auth_client.get("/v1/models")
    assert response.status_code == 401
    assert response.headers.get("www-authenticate") == "Bearer"
    payload = response.json()
    assert payload["error_code"] == "AUTH_REQUIRED"


@pytest.mark.asyncio
async def test_auth_enabled_rejects_invalid_token(auth_client: AsyncClient) -> None:
    response = await auth_client.get("/v1/models", headers={"Authorization": "Bearer wrong"})
    assert response.status_code == 401
    assert response.headers.get("www-authenticate") == "Bearer"
    payload = response.json()
    assert payload["error_code"] == "AUTH_INVALID"


@pytest.mark.asyncio
async def test_auth_enabled_allows_valid_token(auth_client: AsyncClient, auth_api_key: str) -> None:
    response = await auth_client.get(
        "/v1/models",
        headers={"Authorization": f"Bearer {auth_api_key}"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_auth_enabled_allows_x_api_key_header(auth_client: AsyncClient, auth_api_key: str) -> None:
    response = await auth_client.get(
        "/v1/models",
        headers={"X-API-Key": auth_api_key},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_endpoints_remain_anonymous_when_auth_enabled(auth_client: AsyncClient) -> None:
    health = await auth_client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}

    dependency_health = await auth_client.get("/health/dependencies")
    assert dependency_health.status_code == 200
