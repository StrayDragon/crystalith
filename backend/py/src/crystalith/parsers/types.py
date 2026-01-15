from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class Chunk:
    text: str
    start_offset: int | None = None
    end_offset: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ParseResult:
    chunks: list[Chunk]
    metadata: dict[str, Any] = field(default_factory=dict)


ChunkInfo = Chunk
