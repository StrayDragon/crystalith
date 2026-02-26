from __future__ import annotations

import asyncio
import time

import pytest

from crystalith.shared.cache import InMemoryCache, bump_sources_epoch, get_sources_epoch
from crystalith.shared.config import Settings
from crystalith.shared.vector_storage import bump_vector_epoch, get_vector_epoch


@pytest.mark.asyncio
async def test_in_memory_cache_set_get_roundtrip() -> None:
    cache = InMemoryCache(ttl=60, max_size=10)
    await cache.set("k", {"value": 1})
    assert await cache.get("k") == {"value": 1}


@pytest.mark.asyncio
async def test_in_memory_cache_ttl_expiry(monkeypatch: pytest.MonkeyPatch) -> None:
    now = 0.0

    def _monotonic() -> float:
        return now

    # Mock reason: control monotonic clock progression deterministically for TTL assertions.
    monkeypatch.setattr(time, "monotonic", _monotonic)

    cache = InMemoryCache(ttl=1, max_size=10)
    await cache.set("k", "v")
    assert await cache.get("k") == "v"

    now = 2.0
    assert await cache.get("k") is None


@pytest.mark.asyncio
async def test_in_memory_cache_lru_eviction(monkeypatch: pytest.MonkeyPatch) -> None:
    now = 0.0

    def _monotonic() -> float:
        return now

    # Mock reason: control monotonic clock progression deterministically for eviction assertions.
    monkeypatch.setattr(time, "monotonic", _monotonic)

    cache = InMemoryCache(ttl=60, max_size=2)
    await cache.set("a", 1)
    await cache.set("b", 2)

    assert await cache.get("a") == 1  # mark a as most-recently-used
    await cache.set("c", 3)  # should evict b

    assert await cache.get("b") is None
    assert await cache.get("a") == 1
    assert await cache.get("c") == 3


@pytest.mark.asyncio
async def test_in_memory_cache_invalidate_pattern() -> None:
    cache = InMemoryCache(ttl=60, max_size=10)
    await cache.set("notebook:1:sources:list:aaa", 1)
    await cache.set("notebook:1:sources:list:bbb", 2)
    await cache.set("notebook:2:sources:list:ccc", 3)

    deleted = await cache.invalidate_pattern("notebook:1:sources:*")
    assert deleted == 2
    assert await cache.get("notebook:1:sources:list:aaa") is None
    assert await cache.get("notebook:1:sources:list:bbb") is None
    assert await cache.get("notebook:2:sources:list:ccc") == 3


@pytest.mark.asyncio
async def test_in_memory_cache_get_many_roundtrip() -> None:
    cache = InMemoryCache(ttl=60, max_size=10)
    await cache.set("a", 1)
    await cache.set("b", 2)

    values = await cache.get_many(["a", "missing", "b"])
    assert values == [1, None, 2]


@pytest.mark.asyncio
async def test_in_memory_cache_set_many_roundtrip() -> None:
    cache = InMemoryCache(ttl=60, max_size=10)
    await cache.set_many({"a": 1, "b": 2})

    values = await cache.get_many(["a", "b", "missing"])
    assert values == [1, 2, None]


@pytest.mark.asyncio
async def test_in_memory_cache_incr_is_atomic_under_concurrency() -> None:
    cache = InMemoryCache(ttl=60, max_size=10)
    tasks = [cache.incr("k") for _ in range(50)]
    results = await asyncio.gather(*tasks)
    assert len(set(results)) == len(tasks)
    assert await cache.get("k") == 50


@pytest.mark.asyncio
async def test_epoch_bumps_do_not_lose_increments_under_concurrency() -> None:
    cache = InMemoryCache(ttl=60, max_size=10)

    sources_tasks = [bump_sources_epoch(cache=cache, notebook_id=1) for _ in range(25)]
    vector_tasks = [bump_vector_epoch(cache=cache, notebook_id=1) for _ in range(25)]
    await asyncio.gather(*sources_tasks, *vector_tasks)

    assert await get_sources_epoch(cache=cache, notebook_id=1) == 25
    assert await get_vector_epoch(cache=cache, notebook_id=1) == 25


def test_cache_settings_validation_requires_redis_url() -> None:
    with pytest.raises(ValueError, match="redis_url"):
        Settings.model_validate({"cache": {"provider": "redis"}})
