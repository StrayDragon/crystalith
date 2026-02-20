# Configuration

Crystalith runtime configuration lives in `config/app.yaml`.

## Basics

- Keep secrets out of git. Prefer `.env` (Docker Compose) or `CRYSTALITH_SECRETS_PATH`.
- The config supports:
  - `${{ env.VAR }}` interpolation
  - `${{ secrets.VAR }}` interpolation
  - YAML anchors for reuse

## Common settings

- `app.cors.allow_origins`: browser client origins (CORS)
- `models.defaults.chat` / `models.defaults.embedding`: default model ids
- `vector_storage.provider`: `chroma` or `sqlite`
- `database.url`: SQLAlchemy URL (async)
- `embedding.batch_size`: embedding batch size (perf tuning)

## Redis embedding cache

When `cache.provider=redis`, the backend can enable a cross-request embedding cache for small batches to reduce repeated
embedding cost.

Config:
- `cache.provider: redis`
- `cache.redis_url: redis://...`

Env (defaults match `backend/py/src/crystalith/shared/deps.py`):
- `CRYSTALITH_EMBEDDING_CACHE_ENABLED` (default: true)
- `CRYSTALITH_EMBEDDING_CACHE_TTL_S` (default: 600)
- `CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS` (default: 8)
- `CRYSTALITH_EMBEDDING_CACHE_MAX_CHARS` (default: 2000)

Benchmark (requires Redis + optional dependency `redis`):
- `cd backend/py && just embedding-cache-bench`
  - add `--reset-prefix` to clear the benchmark keyspace
  - add `--scan-keys` to count keys for the benchmark prefix (can be slow on large DBs)
  - add `--use-real-embedder --confirm-real-embedder` to use the configured embedding provider

## Speed / quality tuning

Many generation endpoints accept `preference: "quality" | "speed"`.

- Defaults are selected by `(OutputType, preference)` and applied only when the caller doesn't explicitly override
  request parameters (e.g. `top_k`, `min_score`).
- `quality` tends to trade higher latency for better context coverage (for example enabling multi-query retrieval).
- `speed` tends to reduce retrieval/generation cost to lower latency.

### Multi-query override (env)

`CRYSTALITH_RETRIEVAL_MULTI_QUERY` can force multi-query retrieval on/off globally:

- unset: follow the `(OutputType, preference)` default tuning
- truthy: force on
- falsy (`0`, `false`, `no`, `off`): force off

## Secrets

`CRYSTALITH_SECRETS_PATH` can point to either:

- a YAML file (mapping of `KEY: value`), or
- a directory (Docker secrets style: one file per key)

See `docs/deployment.md` for examples.
