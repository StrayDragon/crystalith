from __future__ import annotations

from crystalith.shared.cache.interfaces import CacheProvider

SOURCES_EPOCH_KEY = "notebook:{notebook_id}:sources_epoch"


def make_sources_epoch_key(*, notebook_id: int) -> str:
    return SOURCES_EPOCH_KEY.format(notebook_id=int(notebook_id))


async def get_sources_epoch(*, cache: CacheProvider, notebook_id: int) -> int:
    raw = await cache.get(make_sources_epoch_key(notebook_id=notebook_id))
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 0


async def bump_sources_epoch(*, cache: CacheProvider, notebook_id: int) -> int:
    # Epoch should not expire; old cache keys are evicted via TTL.
    return await cache.incr(make_sources_epoch_key(notebook_id=notebook_id), ttl=0)
