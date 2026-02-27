from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Iterable, Sequence

from .types import VectorEntry, VectorSearchResult


@dataclass(frozen=True, slots=True)
class _StoredEntry:
    entry: VectorEntry
    norm: float


def _dot(left: Sequence[float], right: Sequence[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def _norm(vector: Sequence[float]) -> float:
    return sqrt(sum(value * value for value in vector))


class InMemoryVectorStore:
    def __init__(self) -> None:
        self._entries: list[_StoredEntry] = []

    def __len__(self) -> int:
        return len(self._entries)

    async def add(
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
            entry = VectorEntry(
                notebook_id=notebook_id,
                source_id=source_id,
                chunk_id=chunk_id,
                vector=list(vector),
            )
            self._entries.append(_StoredEntry(entry=entry, norm=norm))

    async def upsert(
        self,
        *,
        notebook_id: int,
        source_id: int,
        chunk_id: int,
        vector: Sequence[float],
    ) -> None:
        await self.add(
            notebook_id=notebook_id,
            source_id=source_id,
            chunk_ids=[chunk_id],
            vectors=[vector],
        )

    async def remove_source(self, source_id: int) -> None:
        self._entries = [entry for entry in self._entries if entry.entry.source_id != source_id]

    async def remove_notebook(self, notebook_id: int) -> None:
        self._entries = [entry for entry in self._entries if entry.entry.notebook_id != notebook_id]

    async def search(
        self,
        *,
        notebook_id: int,
        query_vector: Sequence[float],
        top_k: int = 5,
        min_score: float = 0.2,
        source_ids: Sequence[int] | None = None,
        exclude_source_ids: Sequence[int] | None = None,
    ) -> list[VectorSearchResult]:
        query_len = len(query_vector)
        if query_len == 0:
            return []
        query_norm = _norm(query_vector)
        if query_norm == 0:
            return []

        source_id_set = set(source_ids) if source_ids else None
        exclude_source_id_set = set(exclude_source_ids) if exclude_source_ids else None

        results: list[VectorSearchResult] = []
        for stored in self._entries:
            entry = stored.entry
            if entry.notebook_id != notebook_id:
                continue
            if source_id_set is not None and entry.source_id not in source_id_set:
                continue
            if exclude_source_id_set is not None and entry.source_id in exclude_source_id_set:
                continue
            if len(entry.vector) != query_len:
                continue
            if stored.norm == 0:
                continue
            score = _dot(query_vector, entry.vector) / (query_norm * stored.norm)
            if score < min_score:
                continue
            results.append(VectorSearchResult(entry=entry, score=score))

        results.sort(key=lambda item: item.score, reverse=True)
        return results[:top_k]

    async def search_many(
        self,
        *,
        notebook_id: int,
        query_vectors: Sequence[Sequence[float]],
        top_k: int = 5,
        min_score: float = 0.2,
        source_ids: Sequence[int] | None = None,
        exclude_source_ids: Sequence[int] | None = None,
    ) -> list[list[VectorSearchResult]]:
        return [
            await self.search(
                notebook_id=notebook_id,
                query_vector=query_vector,
                top_k=top_k,
                min_score=min_score,
                source_ids=source_ids,
                exclude_source_ids=exclude_source_ids,
            )
            for query_vector in query_vectors
        ]

    async def entries(
        self,
        *,
        notebook_id: int | None = None,
        source_ids: Sequence[int] | None = None,
    ) -> Iterable[VectorEntry]:
        source_id_set = set(source_ids) if source_ids else None
        filtered: list[VectorEntry] = []
        for stored in self._entries:
            entry = stored.entry
            if notebook_id is not None and entry.notebook_id != notebook_id:
                continue
            if source_id_set is not None and entry.source_id not in source_id_set:
                continue
            filtered.append(entry)
        return tuple(filtered)

    async def close(self) -> None:
        return None
