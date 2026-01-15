from __future__ import annotations

import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SessionCreate(BaseModel):
    title: str | None = Field(default=None, max_length=255)

    @field_validator("title")
    @classmethod
    def _strip_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("title must not be empty")
        return trimmed


class SessionUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)

    @field_validator("title")
    @classmethod
    def _strip_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("title must not be empty")
        return trimmed


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    title: str | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
