from __future__ import annotations

import datetime
from enum import StrEnum
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.api.deps import get_db_session
from crystalith.db import Notebook

router = APIRouter(prefix="/v1/notebooks/{notebook_id}/video-overview", tags=["video-overview"])


class VideoResolution(StrEnum):
    R720P = "720p"
    R1080P = "1080p"


class VideoOverviewStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class VideoOverviewRequest(BaseModel):
    resolution: VideoResolution
    language: str = Field("zh-CN", min_length=1)
    chunk_ids: list[int] | None = None
    include_subtitles: bool = False


class VideoOverviewResponse(BaseModel):
    task_id: str
    status: VideoOverviewStatus
    video_url: str | None = None
    duration: int | None = Field(default=None, ge=0)
    thumbnail_url: str | None = None
    subtitle_url: str | None = None


class VideoOverview(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    status: VideoOverviewStatus
    video_url: str | None = None
    duration: int | None = Field(default=None, ge=0)
    resolution: VideoResolution
    thumbnail_url: str | None = None
    subtitle_url: str | None = None
    language: str
    created_at: datetime.datetime


class VideoOverviewNotImplemented(BaseModel):
    error: str
    status: Literal["coming_soon"]


@router.post("", response_model=VideoOverviewNotImplemented, status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def create_video_overview(
    notebook_id: int,
    _payload: VideoOverviewRequest,
    session: AsyncSession = Depends(get_db_session),
) -> VideoOverviewNotImplemented:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    return VideoOverviewNotImplemented(
        error="Video overview is not yet implemented",
        status="coming_soon",
    )
