from __future__ import annotations

import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


MessageRole = Literal["user", "assistant", "system"]


class MessageCreate(BaseModel):
    role: MessageRole
    content: str = Field(..., min_length=1)
    citations: dict | None = None

    @field_validator("content")
    @classmethod
    def _strip_content(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("content must not be empty")
        return trimmed


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    role: MessageRole
    content: str
    citations: dict | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
