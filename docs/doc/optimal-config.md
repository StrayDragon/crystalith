# Optimal Configuration

This page describes Crystalith’s recommended “optimal” setup profiles for:

- fast local iteration (hot reload)
- production‑like behavior (Docker Compose)
- predictable storage paths (`data/` is anchored to the config root)

## TL;DR

- Recommended local dev: `just dev`
  - backend + frontend run on the host (fast reload)
  - Docker runs deps: Postgres + Chroma + Redis + SearXNG (default)
- Prod-like compose: `just dev-docker-up`
- Minimal/no-docker: `cd backend/py && just dev` (SQLite + embedded Chroma)

## Profile 1: Hybrid dev (recommended)

Hybrid dev is the best day‑to‑day experience: you edit code on the host with fast reload, while Docker provides the
dependency services.

Start:

```bash
cp .env.example .env
cp config/secrets.yaml.example config/secrets.yaml
# edit config/secrets.yaml (OPENAI_API_KEY, POSTGRES_PASSWORD if using Postgres dev-deps)
just dev
```

Defaults:
- deps: `storage redis searxng`
- backend: `http://127.0.0.1:8032`
- frontend: `http://127.0.0.1:3000`

Optional deps:

```bash
# Minimal deps (no web search):
just DEV_DEPS_OPTIONALS="storage redis" dev

# Full deps (add local Ollama):
just DEV_DEPS_OPTIONALS="storage redis searxng ollama" dev
```

Notes:
- Runtime configuration is YAML-first:
  - `config/app.yaml` is the single source of truth for endpoints/providers.
  - `config/secrets.yaml` holds secrets for `${{ secrets.* }}` interpolation (do not commit it).
- Optional deps are connected via YAML candidate lists (compose service name first, then host dev ports).
- Web search / deep research requires SearXNG. If it’s disabled/unavailable you’ll see failures when search is used.

## Profile 2: Prod-like Docker Compose

Use this profile when you want to validate the deployment topology (Nginx front door + API in containers).

Start:

```bash
cp .env.example .env
just dev-docker-up
just dev-docker-smoke
```

Customize overlays:

```bash
# Core only:
just DEV_OPTIONALS="" dev-docker-up

# Add local Ollama:
just DEV_OPTIONALS="storage redis searxng ollama" dev-docker-up
```

## Profile 3: Minimal (no Docker)

This mode is the lightest: SQLite + embedded Chroma (local files under `data/`).

```bash
cd backend/py
uv sync
just db-init
just dev
```

Frontend (optional):

```bash
cd frontend/web
pnpm install
pnpm dev
```

If you want web search in this profile, run SearXNG yourself and set:

- `search.searxng.host` in `config/app.yaml` (or add an entry to `search.searxng.endpoint_candidates`)

## Recommended YAML knobs

In `config/app.yaml`:

- storage (DB + chroma): `database.url_candidates`, `vector_storage.chroma.endpoint_candidates`
- cache: `cache.provider`, `cache.redis_url_candidates`
- search: `search.searxng.host` / `search.searxng.endpoint_candidates`
- ollama: `optional_services.ollama.endpoint` / `optional_services.ollama.endpoint_candidates`
- startup: `app.startup.auto_db_init`

In `.env` (compose/build parameters + a few non-secret runtime overrides):
- `CL_WEB_PORT`, images (`*_IMAGE`), mirrors (`APT_MIRROR`, `UV_INDEX_URL`, `NPM_REGISTRY`), dev-deps ports (`CL_DEPS_*`)
- Optional runtime hints: `OPENAI_BASE_URL_DOCKER`, `CRYSTALITH_DEFAULT_EMBEDDING_MODEL_DOCKER`

## Troubleshooting

- Dependency status: `GET /health/dependencies`
- Logs:
  - prod-like compose: `just dev-docker-logs`
  - dev deps only: `just dev-deps-logs`
