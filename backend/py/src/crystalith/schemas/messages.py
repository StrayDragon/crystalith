from __future__ import annotations

import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .citations import Citation


MessageRole = Literal["user", "assistant", "system"]


class MessageCreate(BaseModel):
    role: MessageRole
    content: str = Field(..., min_length=1)
    citations: list[Citation] | None = None

    @field_validator("content")
    @classmethod
    def _strip_content(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("content must not be empty")
        return trimmed

    @field_validator("citations", mode="before")
    @classmethod
    def _normalize_citations(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, dict):
            items = value.get("items")
            if isinstance(items, list):
                return items
        return value


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    role: MessageRole
    content: str
    citations: list[Citation] | None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    @field_validator("citations", mode="before")
    @classmethod
    def _normalize_citations(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, dict):
            items = value.get("items")
            if isinstance(items, list):
                return items
        return value
