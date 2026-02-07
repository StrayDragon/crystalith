from __future__ import annotations

import hashlib
import json
from collections.abc import Sequence

from cl_logs.logging import get_logger

from crystalith.shared.cache.interfaces import CacheProvider

from .interfaces import VectorStore
from .types import VectorEntry, VectorSearchResult

logger = get_logger(__name__)


def _hash_vector(vector: Sequence[float]) -> str:
    hasher = hashlib.sha256()
    for value in vector:
        hasher.update(f"{float(value):.6f},".encode())
    return hasher.hexdigest()


def make_vector_search_cache_key(
    *,
    notebook_id: int,
    query_vector: Sequence[float],
    top_k: int,
    min_score: float,
    source_ids: Sequence[int] | None,
    exclude_source_ids: Sequence[int] | None,
) -> str:
    payload = {
        "vector": _hash_vector(query_vector),
        "top_k": int(top_k),
        "min_score": float(min_score),
        "source_ids": sorted(set(source_ids)) if source_ids else None,
        "exclude_source_ids": sorted(set(exclude_source_ids)) if exclude_source_ids else None,
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:16]
    return f"notebook:{notebook_id}:vector_search:{digest}"


async def cached_vector_search(
    *,
    cache: CacheProvider,
    vector_store: VectorStore,
    notebook_id: int,
    query_vector: Sequence[float],
    top_k: int = 5,
    min_score: float = 0.2,
    source_ids: Sequence[int] | None = None,
    exclude_source_ids: Sequence[int] | None = None,
) -> list[VectorSearchResult]:
    key = make_vector_search_cache_key(
        notebook_id=notebook_id,
        query_vector=query_vector,
        top_k=top_k,
        min_score=min_score,
        source_ids=source_ids,
        exclude_source_ids=exclude_source_ids,
    )

    cached = await cache.get(key)
    if cached is not None:
        logger.info("cache_hit", key=key)
        results: list[VectorSearchResult] = []
        for row in cached:
            results.append(
                VectorSearchResult(
                    entry=VectorEntry(
                        notebook_id=notebook_id,
                        source_id=int(row["source_id"]),
                        chunk_id=int(row["chunk_id"]),
                        vector=[],
                    ),
                    score=float(row["score"]),
                )
            )
        return results

    logger.info("cache_miss", key=key)
    results = await vector_store.search(
        notebook_id=notebook_id,
        query_vector=query_vector,
        top_k=top_k,
        min_score=min_score,
        source_ids=source_ids,
        exclude_source_ids=exclude_source_ids,
    )

    await cache.set(
        key,
        [
            {
                "source_id": result.entry.source_id,
                "chunk_id": result.entry.chunk_id,
                "score": result.score,
            }
            for result in results
        ],
    )
    return results
