from __future__ import annotations

import datetime
import enum
import json
from collections.abc import Mapping, Sequence

from crystalith.shared.json_types import JsonValue

try:
    import redis.asyncio as redis
except ModuleNotFoundError:  # pragma: no cover
    redis = None  # type: ignore[assignment]


def _json_default(value: object) -> object:
    if isinstance(value, datetime.datetime):
        return value.isoformat()
    if isinstance(value, enum.Enum):
        return value.value
    raise TypeError(f"Object of type {type(value)} is not JSON serializable")


class RedisCache:
    def __init__(self, *, redis_url: str, ttl: float = 60.0) -> None:
        if redis is None:  # pragma: no cover
            raise RuntimeError("redis is not installed. Install optional dependency 'redis' to use RedisCache.")
        self._client = redis.from_url(redis_url, decode_responses=True)
        self._default_ttl = float(ttl)

    async def get(self, key: str) -> JsonValue | None:
        raw = await self._client.get(key)
        if raw is None:
            return None
        return json.loads(raw)

    async def get_many(self, keys: Sequence[str]) -> list[JsonValue | None]:
        if not keys:
            return []

        raws = await self._client.mget(list(keys))
        output: list[JsonValue | None] = []
        for raw in raws:
            if raw is None:
                output.append(None)
                continue
            output.append(json.loads(raw))
        return output

    async def set(self, key: str, value: JsonValue, *, ttl: float | None = None) -> None:
        resolved_ttl = self._default_ttl if ttl is None else float(ttl)
        raw = json.dumps(value, ensure_ascii=False, default=_json_default)
        if resolved_ttl > 0:
            await self._client.set(key, raw, ex=int(resolved_ttl))
        else:
            await self._client.set(key, raw)

    async def incr(self, key: str, amount: int = 1, *, ttl: float | None = None) -> int:
        value = await self._client.incrby(key, int(amount))
        if ttl is None:
            return int(value)

        resolved_ttl = float(ttl)
        if resolved_ttl > 0:
            await self._client.expire(key, int(resolved_ttl))
        else:
            await self._client.persist(key)
        return int(value)

    async def set_many(self, items: Mapping[str, JsonValue], *, ttl: float | None = None) -> None:
        if not items:
            return None

        resolved_ttl = self._default_ttl if ttl is None else float(ttl)
        pipe = self._client.pipeline(transaction=False)
        for key, value in items.items():
            raw = json.dumps(value, ensure_ascii=False, default=_json_default)
            if resolved_ttl > 0:
                pipe.set(str(key), raw, ex=int(resolved_ttl))
            else:
                pipe.set(str(key), raw)
        await pipe.execute()

    async def delete(self, key: str) -> None:
        await self._client.delete(key)

    async def invalidate_pattern(self, pattern: str) -> int:
        keys = [key async for key in self._client.scan_iter(match=pattern)]
        if not keys:
            return 0
        await self._client.delete(*keys)
        return len(keys)

    async def close(self) -> None:
        await self._client.close()
        await self._client.connection_pool.disconnect()
