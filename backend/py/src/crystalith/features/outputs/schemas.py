from __future__ import annotations

import datetime

from pydantic import BaseModel, ConfigDict

from crystalith.shared.types import OutputType


class OutputGenerateRequest(BaseModel):
    prompt: str | None = None
    content: dict[str, object] | None = None


class OutputRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    type: OutputType
    prompt: str | None
    chunk_ids: list[int] | None
    content: dict[str, object]
    created_at: datetime.datetime
    updated_at: datetime.datetime
