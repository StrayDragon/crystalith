from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from time import perf_counter

from sqlalchemy import select

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.agents.generation_preference import GenerationPreference
from crystalith.shared.context import TokenCounter
from crystalith.shared.db import Chunk, Source
from crystalith.shared.types import OutputType, SourceStatus
from crystalith.shared.utils import normalize_whitespace
from crystalith.shared.vector_storage import VectorSearchResult, cached_vector_search


@dataclass(frozen=True, slots=True)
class RetrievalStats:
    results: int
    unique_sources: int
    avg_score: float | None
    truncated: bool
    budget_tokens: int | None
    used_tokens: int | None
    reused_chunk_ids: bool


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
    ratio = 0.65
    if output_type == OutputType.SLIDES:
        ratio = 0.75
    if preference == "quality":
        ratio += 0.1
    elif preference == "speed":
        ratio -= 0.1
    return min(0.85, max(0.3, ratio))


def _default_budget_tokens(
    deps: StudioDeps,
    *,
    output_type: OutputType,
    preference: GenerationPreference | None,
) -> int:
    max_tokens = int(getattr(deps.settings.context_window, "max_tokens", 8000) or 8000)
    ratio = _default_budget_ratio(output_type=output_type, preference=preference)
    return max(256, int(max_tokens * ratio))


def _default_max_chunks_per_source(
    *,
    output_type: OutputType,
    preference: GenerationPreference | None,
) -> int:
    base = 2
    if output_type == OutputType.SLIDES:
        base = 2
    if preference == "quality":
        base += 1
    return max(1, base)


def _normalize_chunk_ids(chunk_ids: list[int] | None) -> list[int]:
    if not chunk_ids:
        return []
    normalized: list[int] = []
    seen: set[int] = set()
    for raw in chunk_ids:
        try:
            chunk_id = int(raw)
        except (TypeError, ValueError):
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

    max_chunks = max_chunks_per_source or _default_max_chunks_per_source(
        output_type=output_type, preference=preference
    )
    budget_tokens = token_budget_tokens
    if budget_tokens is None:
        budget_tokens = _default_budget_tokens(deps, output_type=output_type, preference=preference)

    tokenizer_model = _resolve_tokenizer_model_name(deps, model_id=model_id)
    counter = TokenCounter(tokenizer_model)

    normalized_chunk_ids = _normalize_chunk_ids(chunk_ids)
    if normalized_chunk_ids:
        reuse_started = perf_counter()
        db_started = perf_counter()
        rows = await deps.session.execute(
            select(Chunk, Source)
            .join(Source, Source.id == Chunk.source_id)
            .where(
                Chunk.id.in_(normalized_chunk_ids),
                Source.notebook_id == notebook_id,
                Source.id.in_(normalized_source_ids),
            )
        )
        db_ms = int((perf_counter() - db_started) * 1000)
        if timings_ms is not None:
            timings_ms["db_ms"] = db_ms
        chunk_map = {chunk.id: (chunk, source) for chunk, source in rows.all()}

        is_valid = True
        for chunk_id in normalized_chunk_ids:
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

        if is_valid:
            format_started = perf_counter()
            blocks = _build_blocks_from_chunk_ids(normalized_chunk_ids, chunk_map)
            kept_blocks, truncated, used_tokens = _truncate_blocks(
                blocks=blocks, counter=counter, budget_tokens=budget_tokens
            )

            resolved_ids = normalized_chunk_ids[: len(kept_blocks)]
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
                budget_tokens=budget_tokens,
                used_tokens=used_tokens,
                reused_chunk_ids=True,
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

    seed_text = seed.strip() or "Summarize the notebook sources."
    embed_started = perf_counter()
    embeddings = await deps.embedder.embed_batch([seed_text])
    embed_ms = int((perf_counter() - embed_started) * 1000)
    if timings_ms is not None:
        timings_ms["embed_ms"] = embed_ms
    if not embeddings:
        total_ms = int((perf_counter() - started) * 1000)
        timings = {"embed_ms": embed_ms, "total_ms": total_ms}
        stats = RetrievalStats(
            results=0,
            unique_sources=0,
            avg_score=None,
            truncated=False,
            budget_tokens=budget_tokens,
            used_tokens=0,
            reused_chunk_ids=False,
        )
        return RetrievedContext(
            context_text="",
            resolved_chunk_ids=[],
            chunks=[],
            stats=stats,
            timings_ms=timings,
        )

    query_vector = embeddings[0]
    search_started = perf_counter()
    if deps.cache is not None:
        results = await cached_vector_search(
            cache=deps.cache,
            vector_store=deps.vector_store,
            notebook_id=notebook_id,
            query_vector=query_vector,
            trace_id=trace_id,
            request_id=request_id,
            top_k=top_k,
            min_score=min_score,
            source_ids=normalized_source_ids,
        )
    else:
        results = await deps.vector_store.search(
            notebook_id=notebook_id,
            query_vector=query_vector,
            top_k=top_k,
            min_score=min_score,
            source_ids=normalized_source_ids,
        )
    search_ms = int((perf_counter() - search_started) * 1000)
    if timings_ms is not None:
        timings_ms["search_ms"] = search_ms

    if not results:
        total_ms = int((perf_counter() - started) * 1000)
        timings = {"embed_ms": embed_ms, "search_ms": search_ms, "total_ms": total_ms}
        stats = RetrievalStats(
            results=0,
            unique_sources=0,
            avg_score=None,
            truncated=False,
            budget_tokens=budget_tokens,
            used_tokens=0,
            reused_chunk_ids=False,
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
        "search_ms": search_ms,
        "db_ms": db_ms,
        "format_ms": format_ms,
        "total_ms": total_ms,
    }
    stats = RetrievalStats(
        results=len(final_chunk_ids),
        unique_sources=len({int(result.entry.source_id) for result in final_results}),
        avg_score=avg_score,
        truncated=truncated,
        budget_tokens=budget_tokens,
        used_tokens=used_tokens,
        reused_chunk_ids=False,
    )

    return RetrievedContext(
        context_text=final_context,
        resolved_chunk_ids=[int(cid) for cid in final_chunk_ids],
        chunks=[
            RetrievedChunk(chunk=chunk_map[result.entry.chunk_id][0], source=chunk_map[result.entry.chunk_id][1], score=float(result.score))
            for result in final_results
        ],
        stats=stats,
        timings_ms=timings,
    )
