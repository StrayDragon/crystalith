from __future__ import annotations

from collections.abc import Iterable, Sequence

import pytest

from crystalith.shared.cache import InMemoryCache
from crystalith.shared.vector_storage import VectorEntry, VectorSearchResult, bump_vector_epoch, cached_vector_search


class _FailingCache(InMemoryCache):
    async def get(self, key: str):  # noqa: ANN001
        raise RuntimeError(f"cache get unavailable: {key}")

    async def set(self, key: str, value, *, ttl: float | None = None):  # noqa: ANN001
        raise RuntimeError(f"cache set unavailable: {key}")

    async def incr(self, key: str, *, ttl: float | None = None):  # noqa: ANN001
        raise RuntimeError(f"cache incr unavailable: {key}")


class _StubVectorStore:
    def __init__(self) -> None:
        self.search_calls = 0

    async def add(
        self,
        *,
        notebook_id: int,
        source_id: int,
        chunk_ids: Sequence[int],
        vectors: Sequence[Sequence[float]],
    ) -> None:
        return None

    async def upsert(
        self,
        *,
        notebook_id: int,
        source_id: int,
        chunk_id: int,
        vector: Sequence[float],
    ) -> None:
        return None

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
        self.search_calls += 1
        return [
            VectorSearchResult(
                entry=VectorEntry(
                    notebook_id=notebook_id,
                    source_id=1,
                    chunk_id=123,
                    vector=[],
                ),
                score=0.9,
            )
        ]

    async def remove_source(self, source_id: int) -> None:
        return None

    async def remove_notebook(self, notebook_id: int) -> None:
        return None

    async def entries(self) -> Iterable[VectorEntry]:
        return []


@pytest.mark.asyncio
async def test_cached_vector_search_epoch_invalidation() -> None:
    cache = InMemoryCache(ttl=60)
    vector_store = _StubVectorStore()

    params = {
        "cache": cache,
        "vector_store": vector_store,
        "notebook_id": 1,
        "query_vector": [0.1, 0.2, 0.3],
        "top_k": 5,
        "min_score": 0.2,
        "source_ids": [1],
    }

    first = await cached_vector_search(**params)
    assert first
    assert vector_store.search_calls == 1

    second = await cached_vector_search(**params)
    assert second
    assert vector_store.search_calls == 1

    await bump_vector_epoch(cache=cache, notebook_id=1)

    third = await cached_vector_search(**params)
    assert third
    assert vector_store.search_calls == 2


@pytest.mark.asyncio
async def test_cached_vector_search_falls_back_when_cache_unavailable() -> None:
    cache = _FailingCache(ttl=60)
    vector_store = _StubVectorStore()

    params = {
        "cache": cache,
        "vector_store": vector_store,
        "notebook_id": 1,
        "query_vector": [0.1, 0.2, 0.3],
        "top_k": 5,
        "min_score": 0.2,
        "source_ids": [1],
    }

    first = await cached_vector_search(**params)
    second = await cached_vector_search(**params)

    assert first
    assert second
    assert vector_store.search_calls == 2
