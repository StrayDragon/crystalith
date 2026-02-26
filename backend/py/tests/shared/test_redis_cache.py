from __future__ import annotations

import datetime
import enum
from fnmatch import fnmatch
from typing import AsyncIterator

import pytest

from crystalith.shared.cache.redis_cache import RedisCache, _json_default


class _E(enum.Enum):
    A = "a"


def test_json_default_serializes_supported_types() -> None:
    assert _json_default(datetime.datetime(2020, 1, 1)) == "2020-01-01T00:00:00"
    assert _json_default(_E.A) == "a"
    with pytest.raises(TypeError):
        _json_default(object())


class _StubRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.closed = False
        self.connection_pool = self
        self.expires: dict[str, int] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def mget(self, keys: list[str]) -> list[str | None]:
        return [self.store.get(key) for key in keys]

    async def set(self, key: str, value: str, *, ex: int | None = None) -> None:  # noqa: ARG002
        self.store[key] = value

    async def incrby(self, key: str, amount: int) -> int:
        current = self.store.get(key)
        value = int(current) if current is not None else 0
        value += int(amount)
        self.store[key] = str(value)
        return value

    async def expire(self, key: str, ttl: int) -> bool:
        if key not in self.store:
            return False
        self.expires[key] = int(ttl)
        return True

    async def persist(self, key: str) -> bool:
        self.expires.pop(key, None)
        return key in self.store

    def pipeline(self, *, transaction: bool = False):  # noqa: ANN001, ARG002
        stub = self

        class _Pipe:
            def __init__(self) -> None:
                self._ops: list[tuple[str, str]] = []

            def set(self, key: str, value: str, *, ex: int | None = None):  # noqa: ANN001, ARG002
                self._ops.append((key, value))
                return self

            async def execute(self) -> list[bool]:
                for key, value in self._ops:
                    stub.store[key] = value
                return [True for _ in self._ops]

        return _Pipe()

    async def delete(self, *keys: str) -> None:
        for key in keys:
            self.store.pop(key, None)

    async def scan_iter(self, *, match: str) -> AsyncIterator[str]:
        for key in list(self.store.keys()):
            if fnmatch(key, match):
                yield key

    async def close(self) -> None:
        self.closed = True

    async def disconnect(self) -> None:
        self.closed = True


@pytest.mark.asyncio
async def test_redis_cache_roundtrip_and_invalidate_pattern(monkeypatch) -> None:
    stub = _StubRedis()

    class _RedisModule:
        @staticmethod
        def from_url(_url: str, *, decode_responses: bool):  # noqa: ANN001, ARG004
            return stub

    # Mock reason: avoid external Redis dependency while verifying cache contract behavior.
    monkeypatch.setattr("crystalith.shared.cache.redis_cache.redis", _RedisModule)

    cache = RedisCache(redis_url="redis://localhost:6379/0", ttl=1.0)
    assert await cache.get("missing") is None

    await cache.set("a:1", {"v": 1}, ttl=0)
    await cache.set("a:2", {"v": 2})
    assert await cache.get("a:1") == {"v": 1}

    await cache.set_many({"b:1": {"v": 10}, "b:2": {"v": 20}}, ttl=0)
    assert await cache.get_many(["b:1", "missing", "b:2"]) == [{"v": 10}, None, {"v": 20}]

    deleted = await cache.invalidate_pattern("a:*")
    assert deleted == 2
    assert await cache.get("a:1") is None

    deleted2 = await cache.invalidate_pattern("a:*")
    assert deleted2 == 0

    await cache.close()
    assert stub.closed is True


@pytest.mark.asyncio
async def test_redis_cache_incr_roundtrip(monkeypatch) -> None:
    stub = _StubRedis()

    class _RedisModule:
        @staticmethod
        def from_url(_url: str, *, decode_responses: bool):  # noqa: ANN001, ARG004
            return stub

    # Mock reason: avoid external Redis dependency while verifying increment semantics.
    monkeypatch.setattr("crystalith.shared.cache.redis_cache.redis", _RedisModule)

    cache = RedisCache(redis_url="redis://localhost:6379/0", ttl=1.0)

    assert await cache.incr("counter", ttl=0) == 1
    assert await cache.incr("counter", amount=2, ttl=0) == 3
    assert stub.expires == {}
