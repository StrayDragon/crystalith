from __future__ import annotations

from crystalith.shared.config import Settings

from .auto_cache import AutoCache
from .in_memory import InMemoryCache
from .interfaces import CacheProvider
from .redis_cache import RedisCache


def create_cache_provider(settings: Settings) -> CacheProvider:
    cache = settings.cache
    if cache.provider == "auto":
        return AutoCache(settings=settings)
    if cache.provider == "redis":
        redis_url = cache.redis_url
        if redis_url is None or not redis_url.strip():
            raise ValueError("cache.redis_url is required when cache.provider is 'redis'")
        return RedisCache(redis_url=redis_url, ttl=cache.ttl)
    return InMemoryCache(ttl=cache.ttl, max_size=cache.max_size)
