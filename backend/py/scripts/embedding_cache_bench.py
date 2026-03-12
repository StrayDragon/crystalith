from __future__ import annotations

import argparse
import asyncio
from dataclasses import asdict
from pathlib import Path
from time import perf_counter
from typing import Any

try:
    import redis.asyncio as redis
except ModuleNotFoundError:  # pragma: no cover
    redis = None  # type: ignore[assignment]

from crystalith.shared.ai.factory import create_embedding_provider
from crystalith.shared.ai.test_provider import TestEmbeddingProvider
from crystalith.shared.ai.wrappers import CachedEmbeddingProvider, DefaultBatchEmbeddingProvider
from crystalith.shared.cache import CacheProvider, RedisCache, create_cache_provider
from crystalith.shared.config import ConfigManager, Settings
from crystalith.shared.env import (
    CRYSTALITH_EMBEDDING_CACHE_ENABLED,
    CRYSTALITH_EMBEDDING_CACHE_MAX_CHARS,
    CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS,
    CRYSTALITH_EMBEDDING_CACHE_TTL_S,
    EMBEDDING_CACHE_ENABLED_DEFAULT,
    EMBEDDING_CACHE_MAX_CHARS_DEFAULT,
    EMBEDDING_CACHE_MAX_TEXTS_DEFAULT,
    EMBEDDING_CACHE_TTL_S_DEFAULT,
    env_bool,
    env_float,
    env_int,
)


def _repo_root() -> Path:
    # backend/py/scripts/embedding_cache_bench.py -> repo root
    return Path(__file__).resolve().parents[3]


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    idx = int(round((p / 100) * (len(sorted_values) - 1)))
    return float(sorted_values[max(0, min(len(sorted_values) - 1, idx))])


async def _redis_memory_summary(client: Any) -> dict[str, Any]:
    info = await client.info("memory")
    keys = [
        "used_memory",
        "used_memory_human",
        "used_memory_peak",
        "used_memory_peak_human",
        "maxmemory",
        "maxmemory_human",
    ]
    return {key: info.get(key) for key in keys if key in info}


async def _count_keys(client: Any, *, pattern: str, limit: int) -> tuple[int, bool]:
    count = 0
    async for _ in client.scan_iter(match=pattern):
        count += 1
        if count >= limit:
            return count, True
    return count, False


def _load_settings(config_path: Path) -> Settings:
    manager = ConfigManager(config_path=config_path)
    return manager.load()


async def _run(args: argparse.Namespace) -> int:
    config_path = Path(args.config).resolve()
    settings = _load_settings(config_path)

    cache: CacheProvider = create_cache_provider(settings)

    if settings.cache.provider != "redis":
        raise SystemExit("cache.provider must be 'redis' to benchmark Redis embedding cache.")
    if not isinstance(cache, RedisCache):
        raise SystemExit("cache.provider is 'redis' but RedisCache was not created (check dependencies).")

    if redis is None:
        raise SystemExit("redis is not installed. Install backend optional dependency 'redis' to run this benchmark.")

    enabled = env_bool(CRYSTALITH_EMBEDDING_CACHE_ENABLED, EMBEDDING_CACHE_ENABLED_DEFAULT)
    ttl_s = env_float(CRYSTALITH_EMBEDDING_CACHE_TTL_S, EMBEDDING_CACHE_TTL_S_DEFAULT)
    max_texts = env_int(CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS, EMBEDDING_CACHE_MAX_TEXTS_DEFAULT)
    max_chars = env_int(CRYSTALITH_EMBEDDING_CACHE_MAX_CHARS, EMBEDDING_CACHE_MAX_CHARS_DEFAULT)

    if not enabled:
        raise SystemExit(f"{CRYSTALITH_EMBEDDING_CACHE_ENABLED} is disabled; benchmark would not exercise cache.")
    if ttl_s <= 0 or max_texts <= 0 or max_chars <= 0:
        raise SystemExit("Embedding cache guardrails must be positive to run benchmark.")

    if args.texts_per_batch > max_texts:
        raise SystemExit(
            f"--texts-per-batch={args.texts_per_batch} exceeds cache max_texts={max_texts}; "
            f"increase {CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS} or lower texts-per-batch."
        )

    if args.use_real_embedder and not args.confirm_real_embedder:
        raise SystemExit("--use-real-embedder requires --confirm-real-embedder (may call external services).")

    embedder = TestEmbeddingProvider("bench-embed")
    if args.use_real_embedder:
        embedder = create_embedding_provider(settings)

    key_prefix = str(args.key_prefix)
    cached = CachedEmbeddingProvider(
        embedder,
        cache=cache,
        ttl_s=float(ttl_s),
        key_prefix=key_prefix,
        max_texts=max_texts,
        max_chars=max_chars,
    )
    provider = DefaultBatchEmbeddingProvider(cached, batch_size=int(settings.embedding.batch_size))

    redis_client = redis.from_url(str(settings.cache.redis_url), decode_responses=True)
    try:
        if args.reset_prefix:
            deleted = await cache.invalidate_pattern(f"{key_prefix}:*")
            print(f"reset_prefix_deleted={deleted}")

        memory_before = await _redis_memory_summary(redis_client)
        keys_before = None
        if args.scan_keys:
            keys_before = await _count_keys(
                redis_client,
                pattern=f"{key_prefix}:*",
                limit=int(args.scan_limit),
            )

        batch = [f"bench-text-{idx % args.unique_texts}" for idx in range(args.texts_per_batch)]

        warmup_started = perf_counter()
        await provider.embed_batch(batch)
        warmup_ms = int((perf_counter() - warmup_started) * 1000)
        warmup_stats = cached.last_stats

        repeat_ms_values: list[float] = []
        for _ in range(args.repeats):
            started = perf_counter()
            await provider.embed_batch(batch)
            repeat_ms_values.append((perf_counter() - started) * 1000)
        repeat_stats = cached.last_stats

        memory_after = await _redis_memory_summary(redis_client)
        keys_after = None
        if args.scan_keys:
            keys_after = await _count_keys(
                redis_client,
                pattern=f"{key_prefix}:*",
                limit=int(args.scan_limit),
            )

        report: dict[str, Any] = {
            "config_path": str(config_path),
            "key_prefix": key_prefix,
            "texts_per_batch": int(args.texts_per_batch),
            "unique_texts": int(args.unique_texts),
            "repeats": int(args.repeats),
            "cache_env": {
                "ttl_s": float(ttl_s),
                "max_texts": int(max_texts),
                "max_chars": int(max_chars),
            },
            "warmup": {
                "warmup_ms": warmup_ms,
                "stats": asdict(warmup_stats) if warmup_stats is not None else None,
            },
            "repeat": {
                "p50_ms": round(_percentile(repeat_ms_values, 50), 3),
                "p95_ms": round(_percentile(repeat_ms_values, 95), 3),
                "p99_ms": round(_percentile(repeat_ms_values, 99), 3),
                "stats": asdict(repeat_stats) if repeat_stats is not None else None,
            },
            "redis_memory_before": memory_before,
            "redis_memory_after": memory_after,
        }
        if keys_before is not None and keys_after is not None:
            report["redis_keys_before"] = {"count": keys_before[0], "truncated": keys_before[1]}
            report["redis_keys_after"] = {"count": keys_after[0], "truncated": keys_after[1]}

        for line in [
            f"warmup_ms={report['warmup']['warmup_ms']}",
            f"repeat_p50_ms={report['repeat']['p50_ms']}",
            f"repeat_p95_ms={report['repeat']['p95_ms']}",
            f"repeat_p99_ms={report['repeat']['p99_ms']}",
        ]:
            print(line)
        print("warmup_stats=", report["warmup"]["stats"])
        print("repeat_stats=", report["repeat"]["stats"])
        print("redis_memory_before=", memory_before)
        print("redis_memory_after=", memory_after)
        if keys_before is not None and keys_after is not None:
            print("redis_keys_before=", report["redis_keys_before"])
            print("redis_keys_after=", report["redis_keys_after"])

        return 0
    finally:
        cache_close = getattr(cache, "close", None)
        if cache_close is not None:
            await cache_close()

        client_close = getattr(redis_client, "close", None)
        if client_close is not None:
            await client_close()
        pool = getattr(redis_client, "connection_pool", None)
        disconnect = getattr(pool, "disconnect", None) if pool is not None else None
        if disconnect is not None:
            await disconnect()


def _parse_args() -> argparse.Namespace:
    repo_root = _repo_root()
    parser = argparse.ArgumentParser(description="Benchmark Redis embedding cache hit/miss and overhead.")
    parser.add_argument(
        "--config",
        default=str(repo_root / "config" / "app.yaml"),
        help="Path to config/app.yaml (default: repo config/app.yaml).",
    )
    parser.add_argument("--key-prefix", default="embedding-bench", help="Redis key prefix to use for this run.")
    parser.add_argument("--unique-texts", type=int, default=32, help="Number of unique texts in the pool.")
    parser.add_argument("--texts-per-batch", type=int, default=8, help="Texts per embed_batch call.")
    parser.add_argument("--repeats", type=int, default=30, help="Repeat calls after warmup.")
    parser.add_argument(
        "--reset-prefix",
        action="store_true",
        help="Delete existing keys for this key prefix before running.",
    )
    parser.add_argument(
        "--scan-keys",
        action="store_true",
        help="Count keys for this key prefix via SCAN (may be slow on large DB).",
    )
    parser.add_argument(
        "--scan-limit",
        type=int,
        default=50_000,
        help="Stop counting keys after this limit (only used with --scan-keys).",
    )
    parser.add_argument(
        "--use-real-embedder",
        action="store_true",
        help="Use the configured embedding provider (may call external services).",
    )
    parser.add_argument(
        "--confirm-real-embedder",
        action="store_true",
        help="Required with --use-real-embedder.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    raise SystemExit(asyncio.run(_run(args)))


if __name__ == "__main__":
    main()
