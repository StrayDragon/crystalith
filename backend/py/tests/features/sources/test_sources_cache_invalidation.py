from __future__ import annotations

import pytest

from crystalith.features.sources.api_common import _invalidate_notebook_source_caches
from crystalith.shared.cache import InMemoryCache


class _FailingEpochCache(InMemoryCache):
    async def incr(self, key: str, *, ttl: float | None = None):  # noqa: ANN001
        raise RuntimeError(f"cache epoch unavailable: {key}")


@pytest.mark.asyncio
async def test_invalidate_notebook_source_caches_is_best_effort() -> None:
    cache = _FailingEpochCache(ttl=60.0)
    await _invalidate_notebook_source_caches(
        cache,
        notebook_id=123,
        vectors_changed=True,
    )
