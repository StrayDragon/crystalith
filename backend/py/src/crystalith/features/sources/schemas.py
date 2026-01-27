from __future__ import annotations

import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from crystalith.shared.types import SourceStatus


class SourceCreate(BaseModel):
    filename: str = Field(..., min_length=1, max_length=512)
    content: str | None = None
    mime_type: str | None = None
    parser_type: str = Field("text", min_length=1, max_length=64)
    metadata: dict[str, Any] | None = None


class SourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    filename: str
    mime_type: str | None
    parser_type: str
    metadata: dict[str, Any] | None = Field(
        default=None,
        validation_alias="metadata_",
        serialization_alias="metadata",
    )
    status: SourceStatus
    error_message: str | None
    chunk_count: int = 0
    created_at: datetime.datetime
    updated_at: datetime.datetime
