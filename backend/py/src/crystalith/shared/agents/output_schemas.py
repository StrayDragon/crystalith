from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator


def _normalize_citations(value: object) -> list[int]:
    if value is None:
        return []

    def _push_int(items: list[int], item: object) -> None:
        if item is None or isinstance(item, (dict, list, bool)):
            return
        if not isinstance(item, (int, float, str)):
            return
        try:
            parsed = int(item)
        except (TypeError, ValueError):
            return
        if parsed <= 0 or parsed in items:
            return
        items.append(parsed)

    if isinstance(value, (int, float)):
        items: list[int] = []
        _push_int(items, value)
        return items

    if isinstance(value, str):
        items = []
        token = ""
        for ch in value:
            if ch.isdigit():
                token += ch
                continue
            if token:
                _push_int(items, token)
                token = ""
        if token:
            _push_int(items, token)
        return items

    if isinstance(value, list):
        items = []
        for item in value:
            _push_int(items, item)
        return items

    return []


CitationIndices = Annotated[list[int], BeforeValidator(_normalize_citations)]


class CitedText(BaseModel):
    model_config = ConfigDict(extra="ignore")

    text: str
    citations: CitationIndices = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _coerce_from_str(cls, value: object) -> object:
        if isinstance(value, str):
            return {"text": value, "citations": []}
        return value


class ParagraphOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    text: str
    citations: CitationIndices = Field(default_factory=list)


class BulletsOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: list[CitedText]


class StructuredOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    bullets: list[CitedText]
    terms: list[str] = Field(default_factory=list)
