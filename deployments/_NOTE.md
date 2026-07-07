# Deployment & Config Migration Note (BREAKING)

This repo now treats **`config/app.yaml` (+ `config/secret.env`) as the single source of truth** for runtime/business
configuration.

**BREAKING:** Legacy runtime env overrides are no longer supported (examples: `DATABASE_URL`, `REDIS_URL`,
`CACHE_PROVIDER`, `CRYSTALITH_SEARCH__SEARXNG__HOST`, `AUTO_DB_INIT`, …).

The only supported env vars for configuration are **location/selection**:
- `CRYSTALITH_CONFIG_PATH` / `CRYSTALITH_CONFIG_DIR`

## Quick migration

1) Create a local secrets file (do not commit it):

```bash
cp config/secret.env.example config/secret.env
```

2) Move sensitive values into `config/secret.env` (examples):
- `OPENAI_API_KEY`
- `FIRECRAWL_API_KEY`
- `POSTGRES_PASSWORD` (if using the default Postgres URL candidates)

3) Move non-secret runtime config into `config/app.yaml`:
- DB/cache/search/vector store endpoints + candidates
- startup toggles (e.g. auto migrations)

4) Keep `.env` for compose/build static parameters (ports/images/mirrors) and optional **non-secret** template inputs.
Copying `.env.example` is still
recommended for compose.

## Mapping (old → new)

- `OPENAI_API_KEY` → `config/secret.env: OPENAI_API_KEY` (referenced as `{{ secret.OPENAI_API_KEY }}` in YAML)
- `FIRECRAWL_API_KEY` → `config/secret.env: FIRECRAWL_API_KEY`
- `DATABASE_URL` → `config/app.yaml: database.url` (or use `database.url_candidates` for auto-adapt)
- `POSTGRES_PASSWORD` → `config/secret.env: POSTGRES_PASSWORD` (used by `database.url_candidates`)
- `CHROMA_HOST` / `CHROMA_PORT` → `config/app.yaml: vector_storage.chroma.host/port`
  - Prefer: `vector_storage.chroma.endpoint_candidates` for auto-adapt across profiles
- `CACHE_PROVIDER` / `REDIS_URL` → `config/app.yaml: cache.provider` + `cache.redis_url` / `cache.redis_url_candidates`
- `CRYSTALITH_SEARCH__SEARXNG__HOST` → `config/app.yaml: search.searxng.host`
  - Prefer: `search.searxng.endpoint_candidates` for auto-adapt across profiles
- `AUTO_DB_INIT` → `config/app.yaml: app.startup.auto_db_init`
