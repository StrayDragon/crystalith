from __future__ import annotations

import hashlib
import json
from collections.abc import Sequence
from typing import cast

from lush_logx.logging import get_logger

from crystalith.shared.cache.interfaces import CacheProvider
from crystalith.shared.json_types import JsonDict, JsonValue

from .interfaces import VectorStore
from .types import VectorEntry, VectorSearchResult

logger = get_logger(__name__)

VECTOR_EPOCH_KEY = "notebook:{notebook_id}:vector_epoch"
VECTOR_SEARCH_CACHE_TTL_S = 300.0


def make_vector_epoch_key(*, notebook_id: int) -> str:
    return VECTOR_EPOCH_KEY.format(notebook_id=int(notebook_id))


def _json_int(value: JsonValue) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return None
    return None


def _json_float(value: JsonValue) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


async def get_vector_epoch(*, cache: CacheProvider, notebook_id: int) -> int:
    raw = await cache.get(make_vector_epoch_key(notebook_id=notebook_id))
    if raw is None:
        return 0
    value = _json_int(raw)
    return value if value is not None else 0


async def bump_vector_epoch(*, cache: CacheProvider, notebook_id: int) -> int:
    # Ensure epoch outlives vector_search cache TTL (default 60s).
    return await cache.incr(make_vector_epoch_key(notebook_id=notebook_id), ttl=0)


def _hash_vector(vector: Sequence[float]) -> str:
    hasher = hashlib.sha256()
    for value in vector:
        hasher.update(f"{float(value):.6f},".encode())
    return hasher.hexdigest()


def make_vector_search_cache_key(
    *,
    notebook_id: int,
    epoch: int,
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
    return f"notebook:{notebook_id}:vector_search:v{int(epoch)}:{digest}"


async def cached_vector_search(
    *,
    cache: CacheProvider,
    vector_store: VectorStore,
    notebook_id: int,
    query_vector: Sequence[float],
    trace_id: str | None = None,
    request_id: str | None = None,
    top_k: int = 5,
    min_score: float = 0.2,
    source_ids: Sequence[int] | None = None,
    exclude_source_ids: Sequence[int] | None = None,
) -> list[VectorSearchResult]:
    try:
        epoch = await get_vector_epoch(cache=cache, notebook_id=notebook_id)
    except Exception as exc:
        logger.warning(
            "vector_search_cache_epoch_failed",
            error=str(exc),
            notebook_id=notebook_id,
        )
        epoch = 0

    key = make_vector_search_cache_key(
        notebook_id=notebook_id,
        epoch=epoch,
        query_vector=query_vector,
        top_k=top_k,
        min_score=min_score,
        source_ids=source_ids,
        exclude_source_ids=exclude_source_ids,
    )

    try:
        cached = await cache.get(key)
    except Exception as exc:
        logger.warning(
            "vector_search_cache_get_failed",
            error=str(exc),
            notebook_id=notebook_id,
            key=key,
        )
        cached = None

    if isinstance(cached, list):
        logger.info(
            "cache_hit",
            trace_id=trace_id,
            request_id=request_id,
            key=key,
            notebook_id=notebook_id,
            epoch=epoch,
        )
        results: list[VectorSearchResult] = []
        for row_value in cached:
            if not isinstance(row_value, dict):
                continue
            row = cast(JsonDict, row_value)
            source_id = _json_int(row.get("source_id"))
            chunk_id = _json_int(row.get("chunk_id"))
            score = _json_float(row.get("score"))
            if source_id is None or chunk_id is None or score is None:
                continue
            results.append(
                VectorSearchResult(
                    entry=VectorEntry(
                        notebook_id=notebook_id,
                        source_id=source_id,
                        chunk_id=chunk_id,
                        vector=[],
                    ),
                    score=score,
                )
            )
        return results

    logger.info(
        "cache_miss",
        trace_id=trace_id,
        request_id=request_id,
        key=key,
        notebook_id=notebook_id,
        epoch=epoch,
    )
    results = await vector_store.search(
        notebook_id=notebook_id,
        query_vector=query_vector,
        top_k=top_k,
        min_score=min_score,
        source_ids=source_ids,
        exclude_source_ids=exclude_source_ids,
    )

    try:
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
            ttl=VECTOR_SEARCH_CACHE_TTL_S,
        )
    except Exception as exc:
        logger.warning(
            "vector_search_cache_set_failed",
            error=str(exc),
            notebook_id=notebook_id,
            key=key,
        )
    return results


async def cached_vector_search_many(
    *,
    cache: CacheProvider,
    vector_store: VectorStore,
    notebook_id: int,
    query_vectors: Sequence[Sequence[float]],
    trace_id: str | None = None,
    request_id: str | None = None,
    top_k: int = 5,
    min_score: float = 0.2,
    source_ids: Sequence[int] | None = None,
    exclude_source_ids: Sequence[int] | None = None,
) -> list[list[VectorSearchResult]]:
    if not query_vectors:
        return []

    try:
        epoch = await get_vector_epoch(cache=cache, notebook_id=notebook_id)
    except Exception as exc:
        logger.warning(
            "vector_search_cache_epoch_failed",
            error=str(exc),
            notebook_id=notebook_id,
        )
        epoch = 0

    keys = [
        make_vector_search_cache_key(
            notebook_id=notebook_id,
            epoch=epoch,
            query_vector=query_vector,
            top_k=top_k,
            min_score=min_score,
            source_ids=source_ids,
            exclude_source_ids=exclude_source_ids,
        )
        for query_vector in query_vectors
    ]

    groups: list[list[VectorSearchResult] | None] = [None for _ in query_vectors]
    missing_positions: list[int] = []
    missing_vectors: list[Sequence[float]] = []
    missing_keys: list[str] = []

    try:
        cached_values = await cache.get_many(keys)
    except Exception as exc:
        logger.warning(
            "vector_search_cache_get_many_failed",
            error=str(exc),
            notebook_id=notebook_id,
        )
        cached_values = [None for _ in keys]

    if len(cached_values) != len(keys):  # pragma: no cover - defensive
        fallback_values: list[JsonValue | None] = []
        for key in keys:
            try:
                fallback_values.append(await cache.get(key))
            except Exception as exc:
                logger.warning(
                    "vector_search_cache_get_failed",
                    error=str(exc),
                    notebook_id=notebook_id,
                    key=key,
                )
                fallback_values.append(None)
        cached_values = fallback_values

    for idx, (key, query_vector, cached) in enumerate(zip(keys, query_vectors, cached_values, strict=True)):
        if isinstance(cached, list):
            logger.info(
                "cache_hit",
                trace_id=trace_id,
                request_id=request_id,
                key=key,
                notebook_id=notebook_id,
                epoch=epoch,
            )
            results: list[VectorSearchResult] = []
            for row_value in cached:
                if not isinstance(row_value, dict):
                    continue
                row = cast(JsonDict, row_value)
                source_id = _json_int(row.get("source_id"))
                chunk_id = _json_int(row.get("chunk_id"))
                score = _json_float(row.get("score"))
                if source_id is None or chunk_id is None or score is None:
                    continue
                results.append(
                    VectorSearchResult(
                        entry=VectorEntry(
                            notebook_id=notebook_id,
                            source_id=source_id,
                            chunk_id=chunk_id,
                            vector=[],
                        ),
                        score=score,
                    )
                )
            groups[idx] = results
            continue

        logger.info(
            "cache_miss",
            trace_id=trace_id,
            request_id=request_id,
            key=key,
            notebook_id=notebook_id,
            epoch=epoch,
        )
        missing_positions.append(idx)
        missing_vectors.append(query_vector)
        missing_keys.append(key)

    if missing_vectors:
        miss_groups = await vector_store.search_many(
            notebook_id=notebook_id,
            query_vectors=missing_vectors,
            top_k=top_k,
            min_score=min_score,
            source_ids=source_ids,
            exclude_source_ids=exclude_source_ids,
        )

        set_items: dict[str, JsonValue] = {}
        for position, key, results in zip(missing_positions, missing_keys, miss_groups, strict=True):
            groups[position] = results
            set_items[key] = cast(
                JsonValue,
                [
                    {
                        "source_id": result.entry.source_id,
                        "chunk_id": result.entry.chunk_id,
                        "score": result.score,
                    }
                    for result in results
                ],
            )

        if set_items:
            try:
                await cache.set_many(set_items, ttl=VECTOR_SEARCH_CACHE_TTL_S)
            except Exception as exc:
                logger.warning(
                    "vector_search_cache_set_many_failed",
                    error=str(exc),
                    notebook_id=notebook_id,
                )

    return [group or [] for group in groups]
