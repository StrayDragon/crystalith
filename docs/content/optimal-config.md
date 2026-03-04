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
- `just dev-backend` automatically wires env vars for enabled deps:
  - `DATABASE_URL`, `CHROMA_HOST`, `CHROMA_PORT` (storage)
  - `CACHE_PROVIDER=redis`, `REDIS_URL` (redis)
  - `CRYSTALITH_SEARCH__SEARXNG__HOST` (searxng)
  - `OLLAMA_HOST` (ollama)
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

- `CRYSTALITH_SEARCH__SEARXNG__HOST=http://127.0.0.1:<port>`

## Recommended env knobs

In `.env`:

- `CL_WEB_PORT`: UI port for compose (`web`)
- `REDIS_URL`: override Redis endpoint (the redis compose overlay forces `CACHE_PROVIDER=redis`)
- `DATABASE_URL` / `CHROMA_HOST` / `CHROMA_PORT`: external storage replacement (omit storage overlay)
- `OLLAMA_HOST`: use host/external Ollama (omit ollama overlay)
- `CRYSTALITH_SEARCH__SEARXNG__HOST`: use external SearXNG (omit searxng overlay)

## Troubleshooting

- Dependency status: `GET /health/dependencies`
- Logs:
  - prod-like compose: `just dev-docker-logs`
  - dev deps only: `just dev-deps-logs`
