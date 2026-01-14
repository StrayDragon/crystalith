from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy.pool import StaticPool

from crystalith.app import create_app
from crystalith.audio.types import AudioOverviewRequest
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
async def test_audio_overview_returns_not_implemented(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/audio-overview",
        json={"target_duration": 5},
    )
    assert response.status_code == 501
    assert response.json() == {
        "error": "Audio overview is not yet implemented",
        "status": "coming_soon",
    }


def test_audio_overview_request_validation() -> None:
    with pytest.raises(ValidationError):
        AudioOverviewRequest(target_duration=0)

    with pytest.raises(ValidationError):
        AudioOverviewRequest(target_duration=11)

    payload = AudioOverviewRequest(target_duration=5)
    assert payload.language == "zh-CN"
    assert payload.chunk_ids is None
