from __future__ import annotations

import asyncio
import socket
import threading
import time

import pytest

from crystalith.shared.cache import InMemoryCache, bump_sources_epoch, get_sources_epoch
from crystalith.shared.cache.auto_cache import AutoCache
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


@pytest.mark.asyncio
async def test_auto_cache_upgrades_to_redis_when_reachable(monkeypatch: pytest.MonkeyPatch) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.listen(5)

    stop = threading.Event()

    def _accept_loop() -> None:
        while not stop.is_set():
            try:
                sock.settimeout(0.1)
                conn, _addr = sock.accept()
                conn.close()
            except TimeoutError:
                continue
            except OSError:
                break

    thread = threading.Thread(target=_accept_loop, daemon=True)
    thread.start()

    class _DummyRedis:
        def __init__(self, *, redis_url: str, ttl: float):  # noqa: ARG002
            self.redis_url = redis_url

        async def get(self, key: str):  # noqa: ARG002
            return None

        async def get_many(self, keys):  # noqa: ANN001
            return [None for _ in keys]

        async def set(self, key: str, value, *, ttl=None):  # noqa: ANN001, ARG002
            return None

        async def incr(self, key: str, amount: int = 1, *, ttl=None) -> int:  # noqa: ANN001, ARG002
            return amount

        async def set_many(self, items, *, ttl=None):  # noqa: ANN001, ARG002
            return None

        async def delete(self, key: str):  # noqa: ARG002
            return None

        async def invalidate_pattern(self, pattern: str) -> int:  # noqa: ARG002
            return 0

        async def close(self) -> None:
            return None

    try:
        candidate = f"redis://127.0.0.1:{port}/0"
        settings = Settings.model_validate(
            {"cache": {"provider": "auto", "redis_url_candidates": [candidate], "ttl": 60, "max_size": 10}}
        )

        # Mock reason: avoid requiring a real Redis server while validating auto-upgrade behavior.
        monkeypatch.setattr("crystalith.shared.cache.auto_cache.RedisCache", _DummyRedis)

        cache = AutoCache(settings=settings)
        await cache.get("missing")

        assert settings.cache.provider == "redis"
        assert settings.cache.redis_url == candidate
    finally:
        stop.set()
        try:
            sock.close()
        except OSError:
            pass


@pytest.mark.asyncio
async def test_auto_cache_falls_back_to_memory_on_redis_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.listen(5)

    stop = threading.Event()

    def _accept_loop() -> None:
        while not stop.is_set():
            try:
                sock.settimeout(0.1)
                conn, _addr = sock.accept()
                conn.close()
            except TimeoutError:
                continue
            except OSError:
                break

    thread = threading.Thread(target=_accept_loop, daemon=True)
    thread.start()

    class _FailingRedis:
        def __init__(self, *, redis_url: str, ttl: float):  # noqa: ARG002
            self.redis_url = redis_url

        async def get(self, key: str):  # noqa: ARG002
            raise RuntimeError("redis down")

        async def get_many(self, keys):  # noqa: ANN001
            raise RuntimeError("redis down")

        async def set(self, key: str, value, *, ttl=None):  # noqa: ANN001, ARG002
            raise RuntimeError("redis down")

        async def incr(self, key: str, amount: int = 1, *, ttl=None) -> int:  # noqa: ANN001, ARG002
            raise RuntimeError("redis down")

        async def set_many(self, items, *, ttl=None):  # noqa: ANN001, ARG002
            raise RuntimeError("redis down")

        async def delete(self, key: str):  # noqa: ARG002
            raise RuntimeError("redis down")

        async def invalidate_pattern(self, pattern: str) -> int:  # noqa: ARG002
            raise RuntimeError("redis down")

        async def close(self) -> None:
            return None

    try:
        candidate = f"redis://127.0.0.1:{port}/0"
        settings = Settings.model_validate(
            {"cache": {"provider": "auto", "redis_url_candidates": [candidate], "ttl": 60, "max_size": 10}}
        )

        # Mock reason: simulate Redis runtime errors without requiring a real Redis server.
        monkeypatch.setattr("crystalith.shared.cache.auto_cache.RedisCache", _FailingRedis)

        cache = AutoCache(settings=settings)
        assert await cache.get("missing") is None

        assert settings.cache.provider == "memory"
    finally:
        stop.set()
        try:
            sock.close()
        except OSError:
            pass


@pytest.mark.asyncio
async def test_auto_cache_supports_all_cache_provider_methods_after_upgrade(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.listen(5)

    stop = threading.Event()

    def _accept_loop() -> None:
        while not stop.is_set():
            try:
                sock.settimeout(0.1)
                conn, _addr = sock.accept()
                conn.close()
            except TimeoutError:
                continue
            except OSError:
                break

    thread = threading.Thread(target=_accept_loop, daemon=True)
    thread.start()

    class _DummyRedis:
        def __init__(self, *, redis_url: str, ttl: float):  # noqa: ARG002
            self.redis_url = redis_url
            self.closed = False

        async def get(self, key: str):  # noqa: ARG002
            return None

        async def get_many(self, keys):  # noqa: ANN001
            return [None for _ in keys]

        async def set(self, key: str, value, *, ttl=None):  # noqa: ANN001, ARG002
            return None

        async def incr(self, key: str, amount: int = 1, *, ttl=None) -> int:  # noqa: ANN001, ARG002
            return amount

        async def set_many(self, items, *, ttl=None):  # noqa: ANN001, ARG002
            return None

        async def delete(self, key: str):  # noqa: ARG002
            return None

        async def invalidate_pattern(self, pattern: str) -> int:  # noqa: ARG002
            return 0

        async def close(self) -> None:
            self.closed = True

    try:
        candidate = f"redis://127.0.0.1:{port}/0"
        settings = Settings.model_validate(
            {"cache": {"provider": "auto", "redis_url_candidates": [candidate], "ttl": 60, "max_size": 10}}
        )

        # Mock reason: avoid requiring a real Redis server while covering AutoCache call paths.
        monkeypatch.setattr("crystalith.shared.cache.auto_cache.RedisCache", _DummyRedis)

        cache = AutoCache(settings=settings)

        # Exercise the full CacheProvider surface to keep AutoCache behavior covered.
        assert await cache.get("k") is None
        assert await cache.get_many(["a", "b"]) == [None, None]
        await cache.set("k", {"v": 1})
        assert await cache.incr("counter", 2) == 2
        await cache.set_many({"a": 1, "b": 2})
        await cache.delete("k")
        assert await cache.invalidate_pattern("x*") == 0
        await cache.close()

        assert settings.cache.provider == "redis"
    finally:
        stop.set()
        try:
            sock.close()
        except OSError:
            pass
