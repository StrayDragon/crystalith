<!--
AUTO-GENERATED. DO NOT EDIT BY HAND.
Generator: backend/py/scripts/gen_docs.py (run: just gen-docs)
Source: backend/py/src/crystalith/shared/env.py + config/app.yaml
-->
# Environment Variables Reference (Generated)

This page documents supported environment variables that affect runtime behavior and configuration.

Regeneration:
- `just gen-docs`

## Backend runtime env vars (supported)

SSOT: `backend/py/src/crystalith/shared/env.py`

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `CRYSTALITH_CONFIG_DIR` | `path` | `` | Directory containing app.yaml (used when CRYSTALITH_CONFIG_PATH is unset). |
| `CRYSTALITH_CONFIG_PATH` | `path` | `` | Path to the runtime config YAML file (overrides CRYSTALITH_CONFIG_DIR auto-discovery). |
| `CRYSTALITH_DATA_DIR` | `path` | `` | Override the data directory (defaults to <repo_root>/data or ./data depending on context). |
| `CRYSTALITH_EMBEDDING_CACHE_ENABLED` | `bool` | `True` | Enable Redis embedding cache when cache.provider=redis (small-batch optimization). |
| `CRYSTALITH_EMBEDDING_CACHE_MAX_CHARS` | `int` | `2000` | Max characters per text eligible for embedding cache. |
| `CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS` | `int` | `8` | Max texts per embedding-cache key (safety/perf limit). |
| `CRYSTALITH_EMBEDDING_CACHE_TTL_S` | `float` | `600.0` | Redis embedding cache TTL (seconds). |
| `CRYSTALITH_OBSERVABILITY_SSE_TIMINGS` | `bool` | `False` | Include timings in SSE events (debug/diagnostics). |
| `CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED` | `bool` | `True` | Enable background optional-services probing used by /health/dependencies. |
| `CRYSTALITH_OPTIONAL_SERVICES_MONITOR_INTERVAL_S` | `float` | `15.0` | Optional-services monitor probe interval (seconds). |
| `CRYSTALITH_OPTIONAL_SERVICES_MONITOR_TIMEOUT_S` | `float` | `3.0` | Optional-services monitor probe timeout (seconds). |
| `CRYSTALITH_OUTPUT_REPAIR` | `bool` | `False` | Enable best-effort output repair pass for quality preference (advanced). |
| `CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE` | `bool` | `False` | Enable retrieval assembly cache (requires a cache provider, e.g. Redis). |
| `CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE_TTL_S` | `float` | `20.0` | Retrieval assembly cache TTL (seconds). |
| `CRYSTALITH_RETRIEVAL_FUSION_STRATEGY` | `enum` | `rrf` | Retrieval fusion strategy: rrf\|max_score (invalid values fall back to rrf). |
| `CRYSTALITH_RETRIEVAL_MULTI_QUERY` | `bool` | `` | Force multi-query retrieval on/off (unset uses per-request tuning/config). |

## Config interpolation env vars (referenced by `config/app.yaml`)

These env vars are referenced via `{{ env.* }}` in the default config file.

- `CRYSTALITH_DEFAULT_EMBEDDING_MODEL`
- `OPENAI_BASE_URL`
