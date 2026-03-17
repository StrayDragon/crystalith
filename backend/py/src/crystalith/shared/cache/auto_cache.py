from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable, Mapping, Sequence
from typing import TypeVar

from crystalith.shared.config import Settings
from crystalith.shared.config.endpoint_candidates import order_endpoint_candidates, probe_tcp_endpoint
from crystalith.shared.json_types import JsonValue

from .in_memory import InMemoryCache
from .interfaces import CacheProvider
from .redis_cache import RedisCache

logger = logging.getLogger(__name__)

T = TypeVar("T")


class AutoCache(CacheProvider):
    """
    Fail-open cache provider.

    - Starts with an in-memory cache.
    - When Redis becomes reachable, upgrades to Redis automatically.
    - If Redis later becomes unavailable, falls back to in-memory.
    """

    def __init__(self, *, settings: Settings) -> None:
        self._settings = settings
        self._memory = InMemoryCache(ttl=settings.cache.ttl, max_size=settings.cache.max_size)
        self._provider: CacheProvider = self._memory
        self._lock = asyncio.Lock()
        self._last_upgrade_attempt_at: float = 0.0
        self._disable_redis: bool = False

    def _redis_candidates(self) -> list[str]:
        cache = self._settings.cache
        candidates = []
        if cache.redis_url and cache.redis_url.strip():
            candidates.append(cache.redis_url.strip())
        candidates.extend([c for c in cache.redis_url_candidates if c and c.strip()])
        return order_endpoint_candidates(candidates)

    async def _maybe_upgrade_to_redis(self) -> None:
        if self._disable_redis:
            return

        # Avoid hammering on every request.
        now = time.monotonic()
        if now - self._last_upgrade_attempt_at < 5.0:
            return

        async with self._lock:
            now = time.monotonic()
            if now - self._last_upgrade_attempt_at < 5.0:
                return
            self._last_upgrade_attempt_at = now

            if isinstance(self._provider, RedisCache):
                return

            for candidate in self._redis_candidates():
                ok, _ = await asyncio.to_thread(probe_tcp_endpoint, candidate, timeout_s=0.3)
                if not ok:
                    continue
                try:
                    redis_cache = RedisCache(redis_url=candidate, ttl=self._settings.cache.ttl)
                except Exception as exc:
                    # If redis isn't installed, don't keep retrying forever.
                    logger.info("AutoCache redis upgrade skipped: %s", exc)
                    self._disable_redis = True
                    return

                self._provider = redis_cache
                self._settings.cache.provider = "redis"
                self._settings.cache.redis_url = candidate
                logger.info("AutoCache upgraded to redis: %s", candidate)
                return

    async def _call_with_fallback(
        self,
        call: Callable[[CacheProvider], Awaitable[T]],
        call_memory: Callable[[InMemoryCache], Awaitable[T]],
    ) -> T:
        await self._maybe_upgrade_to_redis()

        provider = self._provider
        try:
            return await call(provider)
        except Exception as exc:
            if not isinstance(provider, RedisCache):
                raise
            logger.warning("Redis cache call failed; falling back to in-memory: %s", exc)
            async with self._lock:
                if self._provider is provider:
                    try:
                        await provider.close()
                    except Exception:
                        logger.debug("Failed to close redis cache after error", exc_info=True)
                    self._provider = self._memory
                    self._settings.cache.provider = "memory"
            return await call_memory(self._memory)

    async def get(self, key: str) -> JsonValue | None:
        return await self._call_with_fallback(
            lambda provider: provider.get(key),
            lambda memory: memory.get(key),
        )

    async def get_many(self, keys: Sequence[str]) -> list[JsonValue | None]:
        return await self._call_with_fallback(
            lambda provider: provider.get_many(keys),
            lambda memory: memory.get_many(keys),
        )

    async def set(self, key: str, value: JsonValue, *, ttl: float | None = None) -> None:
        await self._call_with_fallback(
            lambda provider: provider.set(key, value, ttl=ttl),
            lambda memory: memory.set(key, value, ttl=ttl),
        )

    async def incr(self, key: str, amount: int = 1, *, ttl: float | None = None) -> int:
        return await self._call_with_fallback(
            lambda provider: provider.incr(key, amount, ttl=ttl),
            lambda memory: memory.incr(key, amount, ttl=ttl),
        )

    async def set_many(self, items: Mapping[str, JsonValue], *, ttl: float | None = None) -> None:
        await self._call_with_fallback(
            lambda provider: provider.set_many(items, ttl=ttl),
            lambda memory: memory.set_many(items, ttl=ttl),
        )

    async def delete(self, key: str) -> None:
        await self._call_with_fallback(
            lambda provider: provider.delete(key),
            lambda memory: memory.delete(key),
        )

    async def invalidate_pattern(self, pattern: str) -> int:
        return await self._call_with_fallback(
            lambda provider: provider.invalidate_pattern(pattern),
            lambda memory: memory.invalidate_pattern(pattern),
        )

    async def close(self) -> None:
        provider = self._provider
        await provider.close()
        if provider is not self._memory:
            await self._memory.close()
