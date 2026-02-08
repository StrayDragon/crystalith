from __future__ import annotations

import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from crystalith.shared.types import OutputType


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped


class TemplateConfig(BaseModel):
    session_titles: list[str] = Field(
        default_factory=list,
        description="Notebook sessions to create when using the template.",
    )
    output_type: OutputType | None = Field(
        None,
        description="Preferred default output type for the notebook.",
    )
    source_tags: list[str] = Field(
        default_factory=list,
        description="Source tag names to create when using the template.",
    )

    @field_validator("session_titles")
    @classmethod
    def _normalize_session_titles(cls, value: list[str]) -> list[str]:
        trimmed = [item.strip() for item in value if item and item.strip()]
        return _dedupe(trimmed)

    @field_validator("source_tags")
    @classmethod
    def _normalize_source_tags(cls, value: list[str]) -> list[str]:
        trimmed = [item.strip() for item in value if item and item.strip()]
        return _dedupe(trimmed)


class TemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=2000)
    config_json: TemplateConfig

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("name must not be empty")
        return trimmed

    @field_validator("description")
    @classmethod
    def _strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class TemplateUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=2000)
    config_json: TemplateConfig | None = None

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("name must not be empty")
        return trimmed

    @field_validator("description")
    @classmethod
    def _strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class TemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    config_json: TemplateConfig
    is_builtin: bool
    created_at: datetime.datetime


class TemplateFromNotebookCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=2000)
    output_type: OutputType | None = Field(None, description="Preferred default output type for the template.")

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("name must not be empty")
        return trimmed

    @field_validator("description")
    @classmethod
    def _strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None
