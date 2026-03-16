# Configuration

Crystalith runtime configuration lives in `config/app.yaml`.

## Basics

- Keep secrets out of git. Prefer `config/secrets.yaml` (auto-discovered) or `CRYSTALITH_SECRETS_PATH` (file or Docker secrets dir).
- The config supports:
  - `${{ env.VAR }}` interpolation
  - `${{ secrets.VAR }}` interpolation
  - YAML anchors for reuse
- Environment variables that affect runtime/deploy behavior are indexed in: [Environment Variables Reference (Generated)](reference/env-vars.gen.md)

## Common settings

See [Configuration Schema Reference (Generated)](reference/config-schema.gen.md) for an up-to-date key index (including nested paths).

## Web search (SearXNG)

Crystalith’s web search / deep research uses SearXNG. When `search.searxng.host` is empty, web search is disabled.

Ways to enable:
- Config: set `search.searxng.host` **or** `search.searxng.endpoint_candidates` in `config/app.yaml`

Profile options:
- Include `searxng` in `HYBRID_SERVICES` / `DOCKER_SERVICES` / `FULL_SERVICES` in `.env` (included by default)
- Or add the compose overlay manually: `deployments/prod/docker-compose.searxng.yml`

## API authentication (self-host)

Crystalith can optionally require an API key for all `/v1/**` endpoints.

Config:

```yaml
app:
  auth:
    enabled: true
    api_key: "${{ secrets.CRYSTALITH_API_KEY }}"
```

Notes:
- Prefer `${{ env.* }}` / `${{ secrets.* }}` to avoid committing secrets.
- Clients should send `Authorization: Bearer <token>` (or `X-API-Key: <token>`).
- `/health` and `/health/dependencies` stay anonymous for probes.

## Redis embedding cache

When `cache.provider=redis`, the backend can enable a cross-request embedding cache for small batches to reduce repeated
embedding cost.

Config:
- `cache.provider: redis|auto`
- `cache.redis_url` / `cache.redis_url_candidates`

Env (defaults match `backend/py/src/crystalith/shared/deps.py`):
- See [Environment Variables Reference (Generated)](reference/env-vars.gen.md)

Benchmark (requires Redis + optional dependency `redis`):
- `cd backend/py && just embedding-cache-bench`
  - add `--reset-prefix` to clear the benchmark keyspace
  - add `--scan-keys` to count keys for the benchmark prefix (can be slow on large DBs)
  - add `--use-real-embedder --confirm-real-embedder` to use the configured embedding provider

## URL fetch SSRF protections

`POST /v1/notebooks/{notebook_id}/sources/from-url` supports `mode: fetch`, which makes server-side HTTP requests.

By default, Crystalith blocks high-risk targets (localhost / private networks / cloud metadata IPs) to mitigate SSRF.

Config (in `config/app.yaml`):
- `source_ingestion.url_fetch.security.allowlist_hosts`: exact hostnames to permit
- `source_ingestion.url_fetch.security.allowlist_domains`: domain suffixes to permit (matches `example.com` and `*.example.com`)
- `source_ingestion.url_fetch.security.allowlist_cidrs`: CIDR ranges to permit (use sparingly)
- `source_ingestion.url_fetch.security.allowlist_only`: if true, block everything not allowlisted
- `source_ingestion.url_fetch.security.max_redirects`: redirect hop limit (each hop is revalidated)

Security note: allowlisting internal ranges can re-enable SSRF impact (internal port access, metadata access, etc). Prefer
allowlisting the smallest set of specific hosts/domains.

## Source dedup (optional)

Crystalith can optionally detect duplicate sources for:
- file uploads: `POST /v1/notebooks/{notebook_id}/sources`
- URL imports: `POST /v1/notebooks/{notebook_id}/sources/from-url`

Config (in `config/app.yaml`):
- `source_ingestion.dedup.enabled` (default: false)

Dedup keys (implementation):
- uploads: `sha256(file_bytes)`
- urls: canonicalized URL (strip tracking params like `utm_*`, normalize scheme/host/path, sort query) then hashed

When enabled, a dedup hit does **not** silently drop your request:
- The API may return `409` with `error_code=SOURCE_DEDUP_HIT`, and the UI will prompt:
  - reuse the existing source, or
  - create a new source anyway.
- You can also drive this explicitly via `dedup_action` query param:
  - `dedup_action=reuse`
  - `dedup_action=create_new`

## Source ingestion troubleshooting

When a Source enters `FAILED`, the sources list/get APIs may include diagnostic fields:
- `error_code`
- `error_message`
- `recovery_hint`
- `last_error_at`

Common `error_code` values and fixes:
- `PARSER_FAILED`: the parser crashed. Try converting to plain text/Markdown and re-upload.
- `URL_FETCH_BLOCKED`: SSRF protections blocked the URL. Use a public URL or adjust the allowlist settings above.
- `EXTRACTOR_TIMEOUT`: web extraction timed out. Retry or switch to another extractor.
- `EXTRACTOR_FAILED`: web extraction failed. Retry, switch extractors, or check if the site requires login / blocks crawlers.
- `OPTIONAL_SERVICE_UNAVAILABLE`: an optional dependency is down/misconfigured. Check service connectivity/config.
- `EMBEDDING_FAILED`: embedding provider failed. Check model/provider config and availability.
- `VECTOR_STORE_FAILED`: vector storage failed. Check vector store config/service status.
- `SOURCE_INGESTION_FAILED`: generic fallback when a specific cause isn't available. Check logs and optional service health.

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

If `CRYSTALITH_SECRETS_PATH` is unset, the backend will auto-discover `config/secrets.yaml` next to `config/app.yaml` (if present).

See `docs/deployment.md` for examples.
