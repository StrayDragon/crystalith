from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class VectorEntry:
    notebook_id: int
    source_id: int
    chunk_id: int
    vector: list[float]


@dataclass(frozen=True, slots=True)
class VectorSearchResult:
    entry: VectorEntry
    score: float
