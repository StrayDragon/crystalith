from __future__ import annotations

import hashlib
from collections.abc import Sequence
from typing import Any

from crystalith.shared.cache.interfaces import CacheProvider

from .interfaces import EmbeddingProvider


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _coerce_vector(value: Any) -> list[float] | None:
    if not isinstance(value, list) or not value:
        return None
    output: list[float] = []
    for item in value:
        if not isinstance(item, int | float):
            return None
        output.append(float(item))
    return output


class DefaultBatchEmbeddingProvider:
    """
    Wrap an EmbeddingProvider and apply a configured default batch_size when
    callers don't explicitly provide one.
    """

    def __init__(self, inner: EmbeddingProvider, *, batch_size: int) -> None:
        if batch_size <= 0:
            raise ValueError("batch_size must be greater than 0")
        self._inner = inner
        self._default_batch_size = int(batch_size)

        self.provider = inner.provider
        self.model = inner.model

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        return await self.embed_batch(texts, batch_size=len(texts) or 1)

    async def embed_batch(
        self,
        texts: Sequence[str],
        *,
        batch_size: int | None = None,
    ) -> list[list[float]]:
        resolved = self._default_batch_size if batch_size is None else int(batch_size)
        return await self._inner.embed_batch(texts, batch_size=resolved)


class CachedEmbeddingProvider:
    """
    Wrap an EmbeddingProvider with a cross-request cache.

    Guardrails:
    - Only caches small batches (max_texts) and reasonably short inputs (max_chars)
      to avoid flooding Redis during bulk ingestion.
    - Uses SHA256(text) keys to avoid storing raw content in the cache keyspace.
    """

    def __init__(
        self,
        inner: EmbeddingProvider,
        *,
        cache: CacheProvider,
        ttl_s: float,
        key_prefix: str = "embedding",
        max_texts: int = 8,
        max_chars: int = 2000,
    ) -> None:
        if ttl_s <= 0:
            raise ValueError("ttl_s must be greater than 0")
        if max_texts <= 0:
            raise ValueError("max_texts must be greater than 0")
        if max_chars <= 0:
            raise ValueError("max_chars must be greater than 0")

        self._inner = inner
        self._cache = cache
        self._ttl_s = float(ttl_s)
        self._key_prefix = str(key_prefix)
        self._max_texts = int(max_texts)
        self._max_chars = int(max_chars)

        self.provider = inner.provider
        self.model = inner.model

    def _key(self, text: str) -> str:
        digest = _hash_text(text)
        return f"{self._key_prefix}:{self.provider}:{self.model}:{digest}"

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        return await self.embed_batch(texts, batch_size=len(texts) or 1)

    async def embed_batch(
        self,
        texts: Sequence[str],
        *,
        batch_size: int = 100,
    ) -> list[list[float]]:
        if not texts:
            return []
        if batch_size <= 0:
            raise ValueError("batch_size must be greater than 0")

        if len(texts) > self._max_texts:
            return await self._inner.embed_batch(texts, batch_size=batch_size)
        if any(len(text) > self._max_chars for text in texts):
            return await self._inner.embed_batch(texts, batch_size=batch_size)

        embeddings: list[list[float] | None] = [None] * len(texts)
        positions_by_key: dict[str, list[int]] = {}
        texts_by_key: dict[str, str] = {}

        for idx, text in enumerate(texts):
            key = self._key(text)
            positions_by_key.setdefault(key, []).append(idx)
            texts_by_key.setdefault(key, text)

        keys = list(positions_by_key.keys())
        cached_values = await self._cache.get_many(keys)
        if len(cached_values) != len(keys):  # pragma: no cover - defensive
            cached_values = [await self._cache.get(key) for key in keys]

        missing_keys: list[str] = []
        missing_texts: list[str] = []
        for key, cached in zip(keys, cached_values):
            vector = _coerce_vector(cached)
            if vector is None:
                missing_keys.append(key)
                missing_texts.append(texts_by_key[key])
                continue
            for pos in positions_by_key.get(key, []):
                embeddings[pos] = vector

        if missing_texts:
            miss_vectors = await self._inner.embed_batch(missing_texts, batch_size=batch_size)
            if len(miss_vectors) != len(missing_texts):
                return []

            set_items: dict[str, list[float]] = {}
            for key, vector in zip(missing_keys, miss_vectors):
                coerced = _coerce_vector(vector)
                if coerced is None:
                    return []
                for pos in positions_by_key.get(key, []):
                    embeddings[pos] = coerced
                set_items[key] = coerced

            if set_items:
                await self._cache.set_many(set_items, ttl=self._ttl_s)

        output: list[list[float]] = []
        for vector in embeddings:
            if vector is None or not vector:
                return []
            output.append(list(vector))
        return output
