from __future__ import annotations

import pytest

from crystalith.shared.ai.wrappers import CachedEmbeddingProvider, DefaultBatchEmbeddingProvider
from crystalith.shared.cache import InMemoryCache


class _CountingEmbedder:
    provider = "test"

    def __init__(self) -> None:
        self.model = "counting"
        self.calls: int = 0
        self.last_batch_size: int | None = None

    async def embed(self, texts):
        return await self.embed_batch(texts, batch_size=len(texts) or 1)

    async def embed_batch(self, texts, *, batch_size: int = 100):
        self.calls += 1
        self.last_batch_size = batch_size
        vectors: list[list[float]] = []
        for text in texts:
            digest = sum(text.encode("utf-8")) % 997
            vectors.append([float(digest), 0.0, 0.0])
        return vectors


@pytest.mark.asyncio
async def test_default_batch_embedding_provider_uses_configured_default() -> None:
    inner = _CountingEmbedder()
    wrapped = DefaultBatchEmbeddingProvider(inner, batch_size=32)

    vectors = await wrapped.embed_batch(["a", "b"])
    assert len(vectors) == 2
    assert inner.last_batch_size == 32

    vectors2 = await wrapped.embed_batch(["a"], batch_size=10)
    assert len(vectors2) == 1
    assert inner.last_batch_size == 10


@pytest.mark.asyncio
async def test_cached_embedding_provider_reuses_cached_vectors() -> None:
    inner = _CountingEmbedder()
    cache = InMemoryCache(ttl=60, max_size=128)
    wrapped = CachedEmbeddingProvider(inner, cache=cache, ttl_s=60, max_texts=8, max_chars=2000)

    vectors = await wrapped.embed_batch(["alpha", "beta", "alpha"], batch_size=5)
    assert len(vectors) == 3
    assert inner.calls == 1
    assert wrapped.last_stats is not None
    assert wrapped.last_stats.hit_keys_count == 0
    assert wrapped.last_stats.miss_keys_count == 2

    vectors2 = await wrapped.embed_batch(["alpha", "beta", "alpha"], batch_size=5)
    assert vectors2 == vectors
    assert inner.calls == 1
    assert wrapped.last_stats is not None
    assert wrapped.last_stats.hit_keys_count == 2
    assert wrapped.last_stats.miss_keys_count == 0


@pytest.mark.asyncio
async def test_cached_embedding_provider_skips_large_batches() -> None:
    inner = _CountingEmbedder()
    cache = InMemoryCache(ttl=60, max_size=128)
    wrapped = CachedEmbeddingProvider(inner, cache=cache, ttl_s=60, max_texts=2, max_chars=2000)

    texts = ["a", "b", "c"]
    vectors = await wrapped.embed_batch(texts, batch_size=5)
    assert len(vectors) == len(texts)
    assert inner.calls == 1
    assert wrapped.last_stats is not None
    assert wrapped.last_stats.skipped_reason == "batch_too_large"

    vectors2 = await wrapped.embed_batch(texts, batch_size=5)
    assert vectors2 == vectors
    assert inner.calls == 2
    assert wrapped.last_stats is not None
    assert wrapped.last_stats.skipped_reason == "batch_too_large"
