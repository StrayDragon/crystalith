from __future__ import annotations

import datetime
import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator


_TRIGGER_RE = re.compile(r"^[a-z0-9_-]{1,32}$")


def _normalize_trigger(value: str) -> str:
    trimmed = value.strip().lower()
    if not trimmed:
        raise ValueError("trigger must not be empty")
    if _TRIGGER_RE.match(trimmed) is None:
        raise ValueError("trigger must match [a-z0-9_-]{1,32}")
    return trimmed


class PromptPresetCreate(BaseModel):
    trigger: str = Field(..., min_length=1, max_length=32)
    description: str | None = Field(None, max_length=2000)
    system_prompt: str = Field(..., min_length=1, max_length=50_000)
    enabled: bool = True

    @field_validator("trigger")
    @classmethod
    def _validate_trigger(cls, value: str) -> str:
        return _normalize_trigger(value)

    @field_validator("description")
    @classmethod
    def _strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("system_prompt")
    @classmethod
    def _strip_system_prompt(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("system_prompt must not be empty")
        return trimmed


class PromptPresetUpdate(BaseModel):
    trigger: str | None = Field(None, min_length=1, max_length=32)
    description: str | None = Field(None, max_length=2000)
    system_prompt: str | None = Field(None, min_length=1, max_length=50_000)
    enabled: bool | None = None

    @field_validator("trigger")
    @classmethod
    def _validate_trigger(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_trigger(value)

    @field_validator("description")
    @classmethod
    def _strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("system_prompt")
    @classmethod
    def _strip_system_prompt(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("system_prompt must not be empty")
        return trimmed


PromptPresetSource = Literal["builtin", "custom"]


class PromptPresetRead(BaseModel):
    preset_id: int | None = None
    trigger: str
    description: str | None = None
    system_prompt: str
    enabled: bool
    source: PromptPresetSource
    created_at: datetime.datetime | None = None
    updated_at: datetime.datetime | None = None
