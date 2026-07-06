from __future__ import annotations

from crystalith.shared.config import Settings

from .auto_cache import AutoCache
from .in_memory import InMemoryCache
from .interfaces import CacheProvider


def create_cache_provider(settings: Settings) -> CacheProvider:
    cache = settings.cache
    if cache.provider == "auto":
        return AutoCache(settings=settings)
    return InMemoryCache(ttl=cache.ttl, max_size=cache.max_size)
