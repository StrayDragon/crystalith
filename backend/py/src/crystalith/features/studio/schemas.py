from __future__ import annotations

import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from crystalith.shared.types import SlideStage, SlideStatus


class SlideDraftCreate(BaseModel):
    title: str | None = None
    prompt: str | None = None
    engine: str = Field("slidev", description="Rendering engine (default: slidev)")
    chunk_ids: list[int] | None = None
    generation_config: dict[str, Any] | None = None


class SlideDraftUpdate(BaseModel):
    title: str | None = None
    prompt: str | None = None
    engine: str | None = None
    chunk_ids: list[int] | None = None
    generation_config: dict[str, Any] | None = None


class SlideDraftRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    output_id: int | None
    title: str | None
    prompt: str | None
    engine: str
    chunk_ids: list[int] | None
    outline: dict[str, Any] | None
    markdown: str | None
    generation_config: dict[str, Any] | None
    stage: SlideStage
    status: SlideStatus
    error_message: str | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
