from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence

import pytest

from crystalith.shared.cache import InMemoryCache
from crystalith.shared.json_types import JsonValue
from crystalith.shared.vector_storage import (
    VectorEntry,
    VectorSearchResult,
    bump_vector_epoch,
    cached_vector_search_many,
)


class _CountingCache(InMemoryCache):
    def __init__(self, *, ttl: float = 60.0) -> None:
        super().__init__(ttl=ttl, max_size=2048)
        self.get_calls = 0
        self.get_many_calls = 0
        self.set_calls = 0
        self.set_many_calls = 0

    async def get(self, key: str) -> JsonValue | None:
        self.get_calls += 1
        return await super().get(key)

    async def get_many(self, keys: Sequence[str]) -> list[JsonValue | None]:
        self.get_many_calls += 1
        return await super().get_many(keys)

    async def set(self, key: str, value: JsonValue, *, ttl: float | None = None) -> None:
        self.set_calls += 1
        return await super().set(key, value, ttl=ttl)

    async def set_many(self, items: Mapping[str, JsonValue], *, ttl: float | None = None) -> None:
        self.set_many_calls += 1
        return await super().set_many(items, ttl=ttl)


class _FailingBulkCache(InMemoryCache):
    async def get_many(self, keys: Sequence[str]) -> list[JsonValue | None]:
        raise RuntimeError("cache get_many unavailable")

    async def set_many(self, items: Mapping[str, JsonValue], *, ttl: float | None = None) -> None:
        raise RuntimeError("cache set_many unavailable")

    async def get(self, key: str) -> JsonValue | None:
        raise RuntimeError("cache get unavailable")

    async def incr(self, key: str, amount: int = 1, *, ttl: float | None = None) -> int:  # noqa: ARG002
        raise RuntimeError("cache incr unavailable")


class _StubVectorStore:
    def __init__(self) -> None:
        self.search_many_calls = 0

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
        raise AssertionError("search() should not be called when search_many() is available")

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
        self.search_many_calls += 1
        groups: list[list[VectorSearchResult]] = []
        for idx, _query in enumerate(query_vectors):
            groups.append(
                [
                    VectorSearchResult(
                        entry=VectorEntry(
                            notebook_id=notebook_id,
                            source_id=1,
                            chunk_id=100 + idx,
                            vector=[],
                        ),
                        score=0.9,
                    )
                ]
            )
        return groups

    async def remove_source(self, source_id: int) -> None:
        return None

    async def remove_notebook(self, notebook_id: int) -> None:
        return None

    async def entries(self) -> Iterable[VectorEntry]:
        return []


@pytest.mark.asyncio
async def test_cached_vector_search_many_uses_bulk_cache_and_reuses_results() -> None:
    cache = _CountingCache(ttl=60)
    vector_store = _StubVectorStore()

    params = {
        "cache": cache,
        "vector_store": vector_store,
        "notebook_id": 1,
        "query_vectors": [[0.1, 0.2], [0.2, 0.3], [0.3, 0.4]],
        "top_k": 5,
        "min_score": 0.0,
        "source_ids": [1],
    }

    first = await cached_vector_search_many(**params)
    assert len(first) == 3
    assert vector_store.search_many_calls == 1
    assert cache.get_many_calls == 1
    assert cache.set_many_calls == 1

    second = await cached_vector_search_many(**params)
    assert len(second) == 3
    assert vector_store.search_many_calls == 1
    assert cache.get_many_calls == 2
    assert cache.set_many_calls == 1

    await bump_vector_epoch(cache=cache, notebook_id=1)

    third = await cached_vector_search_many(**params)
    assert len(third) == 3
    assert vector_store.search_many_calls == 2


@pytest.mark.asyncio
async def test_cached_vector_search_many_falls_back_when_cache_unavailable() -> None:
    cache = _FailingBulkCache(ttl=60)
    vector_store = _StubVectorStore()

    params = {
        "cache": cache,
        "vector_store": vector_store,
        "notebook_id": 1,
        "query_vectors": [[0.1, 0.2], [0.2, 0.3]],
        "top_k": 5,
        "min_score": 0.0,
        "source_ids": [1],
    }

    first = await cached_vector_search_many(**params)
    second = await cached_vector_search_many(**params)

    assert len(first) == 2
    assert len(second) == 2
    assert vector_store.search_many_calls == 2
