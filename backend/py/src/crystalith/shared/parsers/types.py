from __future__ import annotations

from dataclasses import dataclass, field

from crystalith.shared.json_types import JsonDict


@dataclass(frozen=True, slots=True)
class Chunk:
    text: str
    start_offset: int | None = None
    end_offset: int | None = None
    metadata: JsonDict = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ParseResult:
    chunks: list[Chunk]
    metadata: JsonDict = field(default_factory=dict)


ChunkInfo = Chunk
