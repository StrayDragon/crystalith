from __future__ import annotations

from collections.abc import AsyncGenerator
import datetime

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy.pool import StaticPool

from crystalith.app import create_app
from crystalith.config import DatabaseSettings, Settings
from crystalith.db import create_all, create_db_manager
from crystalith.api.video_overview import (
    VideoOverview,
    VideoOverviewRequest,
    VideoOverviewResponse,
    VideoOverviewStatus,
    VideoResolution,
)


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
async def test_video_overview_placeholder_response(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/video-overview",
        json={
            "resolution": "720p",
            "language": "zh-CN",
            "chunk_ids": [1, 2],
            "include_subtitles": True,
        },
    )

    assert response.status_code == 501
    assert response.json() == {
        "error": "Video overview is not yet implemented",
        "status": "coming_soon",
    }


def test_video_overview_request_defaults() -> None:
    request = VideoOverviewRequest(resolution=VideoResolution.R1080P)
    assert request.language == "zh-CN"
    assert request.include_subtitles is False


def test_video_overview_request_rejects_invalid_resolution() -> None:
    with pytest.raises(ValidationError):
        VideoOverviewRequest(resolution="4k")


def test_video_overview_response_rejects_negative_duration() -> None:
    with pytest.raises(ValidationError):
        VideoOverviewResponse(
            task_id="task-1",
            status=VideoOverviewStatus.PENDING,
            video_url="https://example.com/video.mp4",
            duration=-5,
            thumbnail_url="https://example.com/thumb.jpg",
            subtitle_url="https://example.com/sub.vtt",
        )


def test_video_overview_model_rejects_invalid_status() -> None:
    with pytest.raises(ValidationError):
        VideoOverview(
            id=1,
            notebook_id=1,
            status="done",
            video_url=None,
            duration=120,
            resolution=VideoResolution.R720P,
            thumbnail_url=None,
            subtitle_url=None,
            language="zh-CN",
            created_at=datetime.datetime.now(datetime.timezone.utc),
        )
