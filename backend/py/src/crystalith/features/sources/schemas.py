from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from .api_schemas import SourceRead


class SourceCreate(BaseModel):
    filename: str = Field(..., min_length=1, max_length=512)
    content: str | None = None
    mime_type: str | None = None
    parser_type: str = Field("text", min_length=1, max_length=64)
    metadata: dict[str, Any] | None = None


__all__ = [
    "SourceCreate",
    "SourceRead",
]
