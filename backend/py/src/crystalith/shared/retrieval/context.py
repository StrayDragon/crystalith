from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
from collections.abc import Sequence
from dataclasses import dataclass
from time import perf_counter

from sqlalchemy import select

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.agents.generation_preference import GenerationPreference, tuning_for_request
from crystalith.shared.cache.epochs import get_sources_epoch
from crystalith.shared.context import TokenCounter
from crystalith.shared.db import Chunk, Source
from crystalith.shared.json_types import JsonValue
from crystalith.shared.types import OutputType, SourceStatus
from crystalith.shared.utils import normalize_whitespace
from crystalith.shared.vector_storage import (
    VectorSearchResult,
    cached_vector_search,
    cached_vector_search_many,
    get_vector_epoch,
)


@dataclass(frozen=True, slots=True)
class RetrievalStats:
    results: int
    unique_sources: int
    avg_score: float | None
    truncated: bool
    max_chunks_per_source: int
    budget_tokens: int | None
    used_tokens: int | None
    reused_chunk_ids: bool
    query_count: int
    multi_query_enabled: bool
    seed_cap: int
    fusion_strategy: str
    cache_hit: bool


@dataclass(frozen=True, slots=True)
class RetrievedChunk:
    chunk: Chunk
    source: Source
    score: float


@dataclass(frozen=True, slots=True)
class RetrievedContext:
    context_text: str
    resolved_chunk_ids: list[int]
    chunks: list[RetrievedChunk]
    stats: RetrievalStats
    timings_ms: dict[str, int]

MULTI_QUERY_ENV = "CRYSTALITH_RETRIEVAL_MULTI_QUERY"
FUSION_STRATEGY_ENV = "CRYSTALITH_RETRIEVAL_FUSION_STRATEGY"
ASSEMBLY_CACHE_ENV = "CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE"
ASSEMBLY_CACHE_TTL_ENV = "CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE_TTL_S"

FUSION_STRATEGY_RRF = "rrf"
FUSION_STRATEGY_MAX_SCORE = "max_score"
ASSEMBLY_CACHE_DEFAULT_TTL_S = 20.0

OUTPUT_TYPE_SEED_HINTS: dict[OutputType, list[str]] = {
    OutputType.TIMELINE: ["提取日期/时间点与关键事件，并按时间顺序组织。"],
    OutputType.QUIZ: ["提取关键概念、定义、事实要点，用于出题与问答。"],
    OutputType.BRIEFING: ["提取背景、关键发现、风险、建议与下一步行动。"],
    OutputType.SLIDES: ["提取主题结构、主论点与支撑要点，适合做幻灯片。"],
}


def _resolve_tokenizer_model_name(
    deps: StudioDeps,
    *,
    model_id: str | None,
) -> str | None:
    try:
        if model_id:
            model_config = deps.settings.get_model_config(model_id)
            if model_config is not None and model_config.model:
                return model_config.model
        default_model = deps.settings.get_default_chat_model()
        if default_model is not None and default_model.model:
            return default_model.model
    except Exception:  # noqa: BLE001 - best-effort token counting
        return None
    return None


def _default_budget_ratio(*, output_type: OutputType, preference: GenerationPreference | None) -> float:
    tuning = tuning_for_request(output_type, preference)
    return float(tuning.token_budget_ratio)


def _default_budget_tokens(
    deps: StudioDeps,
    *,
    output_type: OutputType,
    preference: GenerationPreference | None,
) -> int:
    max_tokens = int(deps.settings.context_window.max_tokens)
    ratio = _default_budget_ratio(output_type=output_type, preference=preference)
    return max(256, int(max_tokens * ratio))


def _default_max_chunks_per_source(
    *,
    output_type: OutputType,
    preference: GenerationPreference | None,
) -> int:
    tuning = tuning_for_request(output_type, preference)
    return max(1, int(tuning.max_chunks_per_source))


def _normalize_chunk_ids(chunk_ids: Sequence[JsonValue] | None) -> list[int]:
    if not chunk_ids:
        return []
    normalized: list[int] = []
    seen: set[int] = set()
    for raw in chunk_ids:
        if raw is None or isinstance(raw, (dict, list)) or isinstance(raw, bool):
            continue
        if not isinstance(raw, (int, float, str)):
            continue
        try:
            chunk_id = int(raw)
        except ValueError:
            continue
        if chunk_id <= 0 or chunk_id in seen:
            continue
        normalized.append(chunk_id)
        seen.add(chunk_id)
    return normalized


def _dedup_text_key(text: str) -> str:
    cleaned = normalize_whitespace(text).lower().strip()
    cleaned = re.sub(r"[^\w\s]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return hashlib.sha256(cleaned.encode("utf-8")).hexdigest()


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _env_bool_optional(name: str) -> bool | None:
    value = os.getenv(name)
    if value is None:
        return None
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return float(default)
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _resolve_fusion_strategy() -> str:
    value = os.getenv(FUSION_STRATEGY_ENV)
    if value is None:
        return FUSION_STRATEGY_RRF

    normalized = value.strip().lower()
    if normalized in {"max", "max_score", "maxscore"}:
        return FUSION_STRATEGY_MAX_SCORE
    if normalized in {FUSION_STRATEGY_RRF}:
        return FUSION_STRATEGY_RRF
    return FUSION_STRATEGY_RRF


def _build_query_seeds(seed_text: str, output_type: OutputType) -> list[str]:
    seeds: list[str] = [seed_text]

    type_prompt = ""
    try:
        type_prompt = output_type.meta.prompt
    except Exception:  # noqa: BLE001 - best-effort
        type_prompt = ""

    if type_prompt:
        seeds.append(type_prompt.strip())

    hints: list[str] = []
    try:
        hints = OUTPUT_TYPE_SEED_HINTS.get(output_type, [])
    except Exception:  # noqa: BLE001 - best-effort
        hints = []

    output_seed_parts: list[str] = [seed_text, f"Output type: {output_type.value}"]
    for hint in hints:
        cleaned = str(hint or "").strip()
        if cleaned:
            output_seed_parts.append(cleaned)

    seeds.append("\n\n".join(output_seed_parts))

    deduped: list[str] = []
    seen: set[str] = set()
    for item in seeds:
        cleaned = item.strip()
        if not cleaned or cleaned in seen:
            continue
        deduped.append(cleaned)
        seen.add(cleaned)
    return deduped


def _select_query_seeds(
    seeds: list[str],
    *,
    seed_cap: int,
) -> list[str]:
    if not seeds:
        return []

    cap = max(1, int(seed_cap))
    if len(seeds) <= cap:
        return seeds
    if cap == 1:
        return seeds[:1]

    kept: list[str] = [seeds[0]]

    output_seed = next((item for item in seeds[1:] if "Output type:" in item), None)
    if output_seed is not None and output_seed not in kept:
        kept.append(output_seed)

    for item in seeds[1:]:
        if item in kept:
            continue
        kept.append(item)
        if len(kept) >= cap:
            break

    return kept[:cap]


async def _vector_search(
    deps: StudioDeps,
    *,
    notebook_id: int,
    query_vector: list[float],
    trace_id: str | None,
    request_id: str | None,
    top_k: int,
    min_score: float,
    source_ids: list[int],
) -> list[VectorSearchResult]:
    if deps.cache is not None:
        return await cached_vector_search(
            cache=deps.cache,
            vector_store=deps.vector_store,
            notebook_id=notebook_id,
            query_vector=query_vector,
            trace_id=trace_id,
            request_id=request_id,
            top_k=top_k,
            min_score=min_score,
            source_ids=source_ids,
        )
    return await deps.vector_store.search(
        notebook_id=notebook_id,
        query_vector=query_vector,
        top_k=top_k,
        min_score=min_score,
        source_ids=source_ids,
    )


async def _vector_search_many(
    deps: StudioDeps,
    *,
    notebook_id: int,
    query_vectors: Sequence[Sequence[float]],
    trace_id: str | None,
    request_id: str | None,
    top_k: int,
    min_score: float,
    source_ids: list[int],
) -> list[list[VectorSearchResult]]:
    if deps.cache is not None:
        return await cached_vector_search_many(
            cache=deps.cache,
            vector_store=deps.vector_store,
            notebook_id=notebook_id,
            query_vectors=query_vectors,
            trace_id=trace_id,
            request_id=request_id,
            top_k=top_k,
            min_score=min_score,
            source_ids=source_ids,
        )

    return await deps.vector_store.search_many(
        notebook_id=notebook_id,
        query_vectors=query_vectors,
        top_k=top_k,
        min_score=min_score,
        source_ids=source_ids,
    )

def _merge_search_results_max_score(
    result_groups: list[list[VectorSearchResult]],
) -> list[VectorSearchResult]:
    merged: dict[int, VectorSearchResult] = {}
    for group in result_groups:
        for result in group:
            chunk_id = int(result.entry.chunk_id)
            existing = merged.get(chunk_id)
            if existing is None or float(result.score) > float(existing.score):
                merged[chunk_id] = result
    output = list(merged.values())
    output.sort(key=lambda item: float(item.score), reverse=True)
    return output


def _merge_search_results_rrf(
    result_groups: list[list[VectorSearchResult]],
    *,
    rrf_k: int = 60,
) -> list[VectorSearchResult]:
    if not result_groups:
        return []

    k = max(1, int(rrf_k))
    fused_scores: dict[int, float] = {}
    best_results: dict[int, VectorSearchResult] = {}
    best_ranks: dict[int, int] = {}

    for group in result_groups:
        for rank, result in enumerate(group, start=1):
            chunk_id = int(result.entry.chunk_id)
            fused_scores[chunk_id] = fused_scores.get(chunk_id, 0.0) + (1.0 / (k + rank))

            existing = best_results.get(chunk_id)
            if existing is None or float(result.score) > float(existing.score):
                best_results[chunk_id] = result

            current_rank = best_ranks.get(chunk_id)
            if current_rank is None or rank < current_rank:
                best_ranks[chunk_id] = rank

    ranked: list[tuple[float, int, float, int]] = []
    for chunk_id, fused_score in fused_scores.items():
        best = best_results[chunk_id]
        ranked.append(
            (
                float(fused_score),
                int(best_ranks.get(chunk_id, 1_000_000)),
                float(best.score),
                int(chunk_id),
            )
        )

    ranked.sort(key=lambda item: (-item[0], item[1], -item[2], item[3]))
    output: list[VectorSearchResult] = []
    for _fused_score, _best_rank, best_score, chunk_id in ranked:
        best = best_results[chunk_id]
        output.append(VectorSearchResult(entry=best.entry, score=best_score))
    return output


def _merge_search_results(
    result_groups: list[list[VectorSearchResult]],
    *,
    strategy: str,
) -> list[VectorSearchResult]:
    if not result_groups:
        return []
    if len(result_groups) <= 1:
        return _merge_search_results_max_score(result_groups)

    if strategy == FUSION_STRATEGY_MAX_SCORE:
        return _merge_search_results_max_score(result_groups)
    return _merge_search_results_rrf(result_groups)


def _apply_dedup_and_diversity(
    *,
    results: list[VectorSearchResult],
    chunk_map: dict[int, tuple[Chunk, Source]],
    max_chunks_per_source: int,
) -> list[VectorSearchResult]:
    kept: list[VectorSearchResult] = []
    seen_chunk_ids: set[int] = set()
    seen_text_keys: set[str] = set()
    per_source: dict[int, int] = {}

    for result in results:
        chunk_id = int(result.entry.chunk_id)
        if chunk_id in seen_chunk_ids:
            continue
        mapping = chunk_map.get(chunk_id)
        if mapping is None:
            continue
        chunk, source = mapping
        if source.status != SourceStatus.READY:
            continue
        if not chunk.text.strip():
            continue

        source_id = int(source.id)
        current = per_source.get(source_id, 0)
        if current >= max_chunks_per_source:
            continue

        text_key = _dedup_text_key(chunk.text)
        if text_key in seen_text_keys:
            continue

        kept.append(result)
        seen_chunk_ids.add(chunk_id)
        seen_text_keys.add(text_key)
        per_source[source_id] = current + 1

    return kept


def _build_blocks_from_results(
    results: list[VectorSearchResult],
    chunk_map: dict[int, tuple[Chunk, Source]],
) -> list[str]:
    blocks: list[str] = []
    for index, result in enumerate(results, start=1):
        chunk, source = chunk_map[result.entry.chunk_id]
        blocks.append(f"[{index}] Source: {source.filename} (chunk {chunk.chunk_index})\n{chunk.text}")
    return blocks


def _build_blocks_from_chunk_ids(
    chunk_ids: list[int],
    chunk_map: dict[int, tuple[Chunk, Source]],
) -> list[str]:
    blocks: list[str] = []
    for index, chunk_id in enumerate(chunk_ids, start=1):
        chunk, source = chunk_map[chunk_id]
        blocks.append(f"[{index}] Source: {source.filename} (chunk {chunk.chunk_index})\n{chunk.text}")
    return blocks


def _truncate_blocks(
    *,
    blocks: list[str],
    counter: TokenCounter,
    budget_tokens: int,
) -> tuple[list[str], bool, int]:
    if budget_tokens <= 0:
        return [], True, 0

    kept: list[str] = []
    used_tokens = 0
    truncated = False
    joiner = "\n\n"
    joiner_tokens = counter.count_text(joiner)

    for block in blocks:
        block_tokens = counter.count_text(block)
        extra_tokens = joiner_tokens if kept else 0
        if used_tokens + extra_tokens + block_tokens <= budget_tokens:
            if extra_tokens:
                used_tokens += extra_tokens
            kept.append(block)
            used_tokens += block_tokens
            continue

        remaining = budget_tokens - used_tokens - extra_tokens
        if remaining <= 0:
            truncated = True
            break

        trimmed = counter.truncate_text(block, remaining)
        if trimmed:
            if extra_tokens:
                used_tokens += extra_tokens
            kept.append(trimmed)
            used_tokens += counter.count_text(trimmed)
        truncated = True
        break

    return kept, truncated, used_tokens


async def _load_chunk_map(
    deps: StudioDeps,
    *,
    chunk_ids: list[int],
) -> dict[int, tuple[Chunk, Source]]:
    if not chunk_ids:
        return {}
    rows = await deps.session.execute(
        select(Chunk, Source)
        .join(Source, Source.id == Chunk.source_id)
        .where(Chunk.id.in_(chunk_ids))
    )
    return {chunk.id: (chunk, source) for chunk, source in rows.all()}


async def _validate_source_ids(
    deps: StudioDeps,
    *,
    notebook_id: int,
    source_ids: list[int],
) -> None:
    if not source_ids:
        raise ValueError("source_ids must not be empty")
    rows = await deps.session.execute(
        select(Source.id).where(
            Source.notebook_id == notebook_id,
            Source.id.in_(source_ids),
        )
    )
    found = {row[0] for row in rows.all()}
    missing = [source_id for source_id in source_ids if source_id not in found]
    if missing:
        raise ValueError("Unknown source_id in source_ids")


async def _make_retrieval_assembly_cache_key(
    cache,
    *,
    notebook_id: int,
    source_ids: list[int],
    seeds: list[str],
    output_type: OutputType,
    preference: GenerationPreference | None,
    top_k: int,
    min_score: float,
    max_chunks_per_source: int,
    budget_tokens: int,
    tokenizer_model: str | None,
    fusion_strategy: str,
) -> str:
    sources_epoch = await get_sources_epoch(cache=cache, notebook_id=notebook_id)
    vector_epoch = await get_vector_epoch(cache=cache, notebook_id=notebook_id)

    seeds_digest = hashlib.sha256("\n\n".join(seeds).encode("utf-8")).hexdigest()
    payload = {
        "source_ids": sorted(set(int(v) for v in source_ids)),
        "seeds": seeds_digest,
        "output_type": output_type.value,
        "preference": preference,
        "top_k": int(top_k),
        "min_score": float(min_score),
        "max_chunks_per_source": int(max_chunks_per_source),
        "budget_tokens": int(budget_tokens),
        "tokenizer_model": tokenizer_model,
        "fusion_strategy": fusion_strategy,
    }
    digest = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()[:16]
    return f"notebook:{int(notebook_id)}:retrieval_assembly:v{int(sources_epoch)}-{int(vector_epoch)}:{digest}"


async def _try_reuse_chunk_ids(
    deps: StudioDeps,
    *,
    notebook_id: int,
    source_ids: list[int],
    chunk_ids: list[int],
    counter: TokenCounter,
    budget_tokens: int,
    max_chunks_per_source: int,
    timings_ms: dict[str, int] | None,
    started: float,
    query_count: int,
    multi_query_enabled: bool,
    seed_cap: int,
    fusion_strategy: str,
    cache_hit: bool,
) -> RetrievedContext | None:
    if not chunk_ids:
        return None

    reuse_started = perf_counter()
    db_started = perf_counter()
    rows = await deps.session.execute(
        select(Chunk, Source)
        .join(Source, Source.id == Chunk.source_id)
        .where(
            Chunk.id.in_(chunk_ids),
            Source.notebook_id == notebook_id,
            Source.id.in_(source_ids),
        )
    )
    db_ms = int((perf_counter() - db_started) * 1000)
    if timings_ms is not None:
        timings_ms["db_ms"] = db_ms
    chunk_map = {chunk.id: (chunk, source) for chunk, source in rows.all()}

    is_valid = True
    for chunk_id in chunk_ids:
        mapping = chunk_map.get(chunk_id)
        if mapping is None:
            is_valid = False
            break
        chunk, source = mapping
        if source.status != SourceStatus.READY:
            is_valid = False
            break
        if not chunk.text.strip():
            is_valid = False
            break

    if not is_valid:
        return None

    format_started = perf_counter()
    blocks = _build_blocks_from_chunk_ids(chunk_ids, chunk_map)
    kept_blocks, truncated, used_tokens = _truncate_blocks(
        blocks=blocks, counter=counter, budget_tokens=budget_tokens
    )

    resolved_ids = chunk_ids[: len(kept_blocks)]
    context_text = "\n\n".join(kept_blocks)
    format_ms = int((perf_counter() - format_started) * 1000)
    reuse_ms = int((perf_counter() - reuse_started) * 1000)
    if timings_ms is not None:
        timings_ms["format_ms"] = format_ms
        timings_ms["reuse_ms"] = reuse_ms

    total_ms = int((perf_counter() - started) * 1000)
    timings: dict[str, int] = {
        "db_ms": db_ms,
        "format_ms": format_ms,
        "reuse_ms": reuse_ms,
        "total_ms": total_ms,
    }
    stats = RetrievalStats(
        results=len(resolved_ids),
        unique_sources=len({int(chunk_map[cid][1].id) for cid in resolved_ids}),
        avg_score=None,
        truncated=truncated,
        max_chunks_per_source=max_chunks_per_source,
        budget_tokens=budget_tokens,
        used_tokens=used_tokens,
        reused_chunk_ids=True,
        query_count=int(query_count),
        multi_query_enabled=bool(multi_query_enabled),
        seed_cap=int(seed_cap),
        fusion_strategy=str(fusion_strategy),
        cache_hit=bool(cache_hit),
    )
    return RetrievedContext(
        context_text=context_text,
        resolved_chunk_ids=resolved_ids,
        chunks=[
            RetrievedChunk(chunk=chunk_map[cid][0], source=chunk_map[cid][1], score=0.0)
            for cid in resolved_ids
        ],
        stats=stats,
        timings_ms=timings,
    )


async def retrieve_context(
    deps: StudioDeps,
    *,
    notebook_id: int,
    seed: str,
    source_ids: list[int] | None,
    output_type: OutputType,
    preference: GenerationPreference | None = None,
    model_id: str | None = None,
    chunk_ids: list[int] | None = None,
    top_k: int = 8,
    min_score: float = 0.2,
    max_chunks_per_source: int | None = None,
    token_budget_tokens: int | None = None,
    timings_ms: dict[str, int] | None = None,
    trace_id: str | None = None,
    request_id: str | None = None,
) -> RetrievedContext:
    started = perf_counter()

    normalized_source_ids = [int(v) for v in (source_ids or []) if int(v) > 0]
    await _validate_source_ids(deps, notebook_id=notebook_id, source_ids=normalized_source_ids)

    tuning = tuning_for_request(output_type, preference)

    embed_limit = int(deps.limiters.embedding.limit) if deps.limiters is not None else 0
    search_limit = int(deps.limiters.vector_search.limit) if deps.limiters is not None else 0

    if max_chunks_per_source is None:
        max_chunks = _default_max_chunks_per_source(output_type=output_type, preference=preference)
    else:
        max_chunks = max(1, int(max_chunks_per_source))

    budget_tokens = token_budget_tokens
    if budget_tokens is None:
        budget_tokens = _default_budget_tokens(deps, output_type=output_type, preference=preference)

    tokenizer_model = _resolve_tokenizer_model_name(deps, model_id=model_id)
    counter = TokenCounter(tokenizer_model)

    normalized_chunk_ids = _normalize_chunk_ids(chunk_ids)
    if normalized_chunk_ids:
        reused = await _try_reuse_chunk_ids(
            deps,
            notebook_id=notebook_id,
            source_ids=normalized_source_ids,
            chunk_ids=normalized_chunk_ids,
            counter=counter,
            budget_tokens=budget_tokens,
            max_chunks_per_source=max_chunks,
            timings_ms=timings_ms,
            started=started,
            query_count=0,
            multi_query_enabled=False,
            seed_cap=1,
            fusion_strategy="reuse",
            cache_hit=False,
        )
        if reused is not None:
            reused.timings_ms.setdefault("embed_limit", embed_limit)
            reused.timings_ms.setdefault("search_limit", search_limit)
            reused.timings_ms.setdefault("embed_wait_ms", 0)
            reused.timings_ms.setdefault("search_wait_ms", 0)
            reused.timings_ms.setdefault("embed_hit", 0)
            reused.timings_ms.setdefault("search_hit", 0)
            return reused

    seed_text = seed.strip() or "Summarize the notebook sources."
    multi_query_override = _env_bool_optional(MULTI_QUERY_ENV)
    multi_query_enabled = (
        bool(multi_query_override) if multi_query_override is not None else bool(tuning.multi_query)
    )
    seed_cap = max(1, int(tuning.multi_query_seed_cap))
    fusion_strategy = _resolve_fusion_strategy()

    seeds = [seed_text]
    if multi_query_enabled:
        seeds = _select_query_seeds(_build_query_seeds(seed_text, output_type), seed_cap=seed_cap)

    cache_key: str | None = None
    cache_enabled = deps.cache is not None and _env_bool(ASSEMBLY_CACHE_ENV, default=False)
    assembly_cache_ttl_s = max(
        0.0,
        _env_float(ASSEMBLY_CACHE_TTL_ENV, ASSEMBLY_CACHE_DEFAULT_TTL_S),
    )
    if cache_enabled and deps.cache is not None:
        cache_key = await _make_retrieval_assembly_cache_key(
            deps.cache,
            notebook_id=notebook_id,
            source_ids=normalized_source_ids,
            seeds=seeds,
            output_type=output_type,
            preference=preference,
            top_k=top_k,
            min_score=min_score,
            max_chunks_per_source=max_chunks,
            budget_tokens=budget_tokens,
            tokenizer_model=tokenizer_model,
            fusion_strategy=fusion_strategy,
        )
        cached_value = await deps.cache.get(cache_key)
        cached_chunk_ids = cached_value if isinstance(cached_value, list) else None
        normalized_cached = _normalize_chunk_ids(cached_chunk_ids)
        if normalized_cached:
            reused = await _try_reuse_chunk_ids(
                deps,
                notebook_id=notebook_id,
                source_ids=normalized_source_ids,
                chunk_ids=normalized_cached,
                counter=counter,
                budget_tokens=budget_tokens,
                max_chunks_per_source=max_chunks,
                timings_ms=timings_ms,
                started=started,
                query_count=len(seeds),
                multi_query_enabled=multi_query_enabled,
                seed_cap=seed_cap,
                fusion_strategy=fusion_strategy,
                cache_hit=True,
            )
            if reused is not None:
                reused.timings_ms.setdefault("embed_limit", embed_limit)
                reused.timings_ms.setdefault("search_limit", search_limit)
                reused.timings_ms.setdefault("embed_wait_ms", 0)
                reused.timings_ms.setdefault("search_wait_ms", 0)
                reused.timings_ms.setdefault("embed_hit", 0)
                reused.timings_ms.setdefault("search_hit", 0)
                return reused
            try:
                await deps.cache.delete(cache_key)
            except Exception:  # noqa: BLE001 - best-effort
                pass

    embed_wait_ms = 0
    embed_hit = 0
    embed_started = perf_counter()
    if deps.limiters is None:
        embeddings = await deps.embedder.embed_batch(seeds)
    else:
        async with deps.limiters.embedding.acquire() as lease:
            embed_wait_ms = int(lease.wait_ms)
            embed_hit = int(lease.hit)
            embeddings = await deps.embedder.embed_batch(seeds)
    embed_ms = int((perf_counter() - embed_started) * 1000)
    if timings_ms is not None:
        timings_ms["embed_ms"] = embed_ms
        timings_ms["embed_wait_ms"] = embed_wait_ms
        timings_ms["embed_limit"] = embed_limit
        timings_ms["embed_hit"] = embed_hit
    if not embeddings:
        total_ms = int((perf_counter() - started) * 1000)
        timings = {
            "embed_ms": embed_ms,
            "embed_wait_ms": embed_wait_ms,
            "embed_limit": embed_limit,
            "embed_hit": embed_hit,
            "search_wait_ms": 0,
            "search_limit": search_limit,
            "search_hit": 0,
            "total_ms": total_ms,
        }
        stats = RetrievalStats(
            results=0,
            unique_sources=0,
            avg_score=None,
            truncated=False,
            max_chunks_per_source=max_chunks,
            budget_tokens=budget_tokens,
            used_tokens=0,
            reused_chunk_ids=False,
            query_count=len(seeds),
            multi_query_enabled=multi_query_enabled,
            seed_cap=seed_cap,
            fusion_strategy=fusion_strategy,
            cache_hit=False,
        )
        return RetrievedContext(
            context_text="",
            resolved_chunk_ids=[],
            chunks=[],
            stats=stats,
            timings_ms=timings,
        )

    search_wait_ms = 0
    search_hit = 0
    search_started = perf_counter()
    query_vectors = [list(vector) for vector in embeddings if vector]
    if query_vectors:
        if deps.limiters is None:
            result_groups = await _vector_search_many(
                deps,
                notebook_id=notebook_id,
                query_vectors=query_vectors,
                trace_id=trace_id,
                request_id=request_id,
                top_k=top_k,
                min_score=min_score,
                source_ids=normalized_source_ids,
            )
        else:
            async with deps.limiters.vector_search.acquire() as lease:
                search_wait_ms = int(lease.wait_ms)
                search_hit = int(lease.hit)
                result_groups = await _vector_search_many(
                    deps,
                    notebook_id=notebook_id,
                    query_vectors=query_vectors,
                    trace_id=trace_id,
                    request_id=request_id,
                    top_k=top_k,
                    min_score=min_score,
                    source_ids=normalized_source_ids,
                )
    else:
        result_groups = []
    results = _merge_search_results(result_groups, strategy=fusion_strategy)
    search_ms = int((perf_counter() - search_started) * 1000)
    if timings_ms is not None:
        timings_ms["search_ms"] = search_ms
        timings_ms["search_wait_ms"] = search_wait_ms
        timings_ms["search_limit"] = search_limit
        timings_ms["search_hit"] = search_hit

    if not results:
        total_ms = int((perf_counter() - started) * 1000)
        timings = {
            "embed_ms": embed_ms,
            "embed_wait_ms": embed_wait_ms,
            "embed_limit": embed_limit,
            "embed_hit": embed_hit,
            "search_ms": search_ms,
            "search_wait_ms": search_wait_ms,
            "search_limit": search_limit,
            "search_hit": search_hit,
            "total_ms": total_ms,
        }
        stats = RetrievalStats(
            results=0,
            unique_sources=0,
            avg_score=None,
            truncated=False,
            max_chunks_per_source=max_chunks,
            budget_tokens=budget_tokens,
            used_tokens=0,
            reused_chunk_ids=False,
            query_count=len(seeds),
            multi_query_enabled=multi_query_enabled,
            seed_cap=seed_cap,
            fusion_strategy=fusion_strategy,
            cache_hit=False,
        )
        return RetrievedContext(
            context_text="",
            resolved_chunk_ids=[],
            chunks=[],
            stats=stats,
            timings_ms=timings,
        )

    result_chunk_ids = [result.entry.chunk_id for result in results]
    db_started = perf_counter()
    chunk_map = await _load_chunk_map(deps, chunk_ids=result_chunk_ids)
    db_ms = int((perf_counter() - db_started) * 1000)
    if timings_ms is not None:
        timings_ms["db_ms"] = db_ms

    filtered = _apply_dedup_and_diversity(
        results=results,
        chunk_map=chunk_map,
        max_chunks_per_source=max_chunks,
    )

    format_started = perf_counter()
    blocks = _build_blocks_from_results(filtered, chunk_map)
    kept_blocks, truncated, used_tokens = _truncate_blocks(
        blocks=blocks, counter=counter, budget_tokens=budget_tokens
    )
    final_results = filtered[: len(kept_blocks)]
    final_chunk_ids = [result.entry.chunk_id for result in final_results]
    final_context = "\n\n".join(kept_blocks)
    format_ms = int((perf_counter() - format_started) * 1000)
    if timings_ms is not None:
        timings_ms["format_ms"] = format_ms

    scores = [float(result.score) for result in final_results]
    avg_score = sum(scores) / len(scores) if scores else None

    total_ms = int((perf_counter() - started) * 1000)
    timings = {
        "embed_ms": embed_ms,
        "embed_wait_ms": embed_wait_ms,
        "embed_limit": embed_limit,
        "embed_hit": embed_hit,
        "search_ms": search_ms,
        "search_wait_ms": search_wait_ms,
        "search_limit": search_limit,
        "search_hit": search_hit,
        "db_ms": db_ms,
        "format_ms": format_ms,
        "total_ms": total_ms,
    }
    stats = RetrievalStats(
        results=len(final_chunk_ids),
        unique_sources=len({int(result.entry.source_id) for result in final_results}),
        avg_score=avg_score,
        truncated=truncated,
        max_chunks_per_source=max_chunks,
        budget_tokens=budget_tokens,
        used_tokens=used_tokens,
        reused_chunk_ids=False,
        query_count=len(seeds),
        multi_query_enabled=multi_query_enabled,
        seed_cap=seed_cap,
        fusion_strategy=fusion_strategy,
        cache_hit=False,
    )

    if cache_enabled and cache_key is not None and deps.cache is not None and final_chunk_ids:
        try:
            await deps.cache.set(
                cache_key,
                [int(cid) for cid in final_chunk_ids],
                ttl=assembly_cache_ttl_s,
            )
        except Exception:  # noqa: BLE001 - best-effort cache
            pass

    return RetrievedContext(
        context_text=final_context,
        resolved_chunk_ids=[int(cid) for cid in final_chunk_ids],
        chunks=[
            RetrievedChunk(
                chunk=chunk_map[result.entry.chunk_id][0],
                source=chunk_map[result.entry.chunk_id][1],
                score=float(result.score),
            )
            for result in final_results
        ],
        stats=stats,
        timings_ms=timings,
    )
