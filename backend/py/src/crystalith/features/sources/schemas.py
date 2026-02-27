from __future__ import annotations

from pydantic import BaseModel, Field

from crystalith.shared.json_types import JsonDict

from .api_schemas import SourceRead


class SourceCreate(BaseModel):
    filename: str = Field(..., min_length=1, max_length=512)
    content: str | None = None
    mime_type: str | None = None
    parser_type: str = Field("text", min_length=1, max_length=64)
    metadata: JsonDict | None = None


__all__ = [
    "SourceCreate",
    "SourceRead",
]
