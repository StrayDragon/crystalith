from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Iterable, Sequence


@dataclass(frozen=True, slots=True)
class VectorEntry:
    notebook_id: int
    source_id: int
    chunk_id: int
    vector: list[float]
    norm: float


@dataclass(frozen=True, slots=True)
class VectorSearchResult:
    entry: VectorEntry
    score: float


def _dot(left: Sequence[float], right: Sequence[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def _norm(vector: Sequence[float]) -> float:
    return sqrt(sum(value * value for value in vector))


class InMemoryVectorIndex:
    def __init__(self) -> None:
        self._entries: list[VectorEntry] = []

    def __len__(self) -> int:
        return len(self._entries)

    def add(
        self,
        *,
        notebook_id: int,
        source_id: int,
        chunk_ids: Sequence[int],
        vectors: Sequence[Sequence[float]],
    ) -> None:
        vectors_list = [list(vector) for vector in vectors]
        if len(chunk_ids) != len(vectors_list):
            raise ValueError("chunk_ids length must match vectors length")

        if vectors_list:
            expected_dim = len(vectors_list[0])
            for vector in vectors_list[1:]:
                if len(vector) != expected_dim:
                    raise ValueError("vectors must have consistent dimensions")

        for chunk_id, vector in zip(chunk_ids, vectors_list):
            norm = _norm(vector)
            self._entries.append(
                VectorEntry(
                    notebook_id=notebook_id,
                    source_id=source_id,
                    chunk_id=chunk_id,
                    vector=list(vector),
                    norm=norm,
                )
            )

    def remove_source(self, source_id: int) -> None:
        self._entries = [entry for entry in self._entries if entry.source_id != source_id]

    def remove_notebook(self, notebook_id: int) -> None:
        self._entries = [entry for entry in self._entries if entry.notebook_id != notebook_id]

    def search(
        self,
        *,
        notebook_id: int,
        query_vector: Sequence[float],
        top_k: int = 5,
        min_score: float = 0.2,
    ) -> list[VectorSearchResult]:
        query_len = len(query_vector)
        if query_len == 0:
            return []
        query_norm = _norm(query_vector)
        if query_norm == 0:
            return []

        results: list[VectorSearchResult] = []
        for entry in self._entries:
            if entry.notebook_id != notebook_id:
                continue
            if len(entry.vector) != query_len:
                continue
            if entry.norm == 0:
                continue
            score = _dot(query_vector, entry.vector) / (query_norm * entry.norm)
            if score < min_score:
                continue
            results.append(VectorSearchResult(entry=entry, score=score))

        results.sort(key=lambda item: item.score, reverse=True)
        return results[:top_k]

    def entries(self) -> Iterable[VectorEntry]:
        return tuple(self._entries)
