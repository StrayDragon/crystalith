from __future__ import annotations

import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AudioOverviewStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AudioOverviewRequest(BaseModel):
    target_duration: int = Field(..., ge=1, le=10)
    language: str = Field("zh-CN", min_length=1)
    chunk_ids: list[int] | None = None


class AudioOverviewResponse(BaseModel):
    task_id: int
    status: AudioOverviewStatus
    audio_url: str | None = None
    duration: int | None = None
    script: str | None = None


class AudioOverview(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    status: AudioOverviewStatus
    audio_url: str | None = None
    duration: int | None = None
    script: str | None = None
    language: str
    created_at: datetime.datetime


class AudioOverviewNotImplemented(BaseModel):
    error: str
    status: Literal["coming_soon"]
