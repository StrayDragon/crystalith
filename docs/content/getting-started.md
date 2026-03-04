# Getting Started

## Prerequisites

- Python 3.12
- Node 20 + pnpm
- `uv` (Python package manager)
- Docker (recommended for local deps)

## Recommended dev (host hot reload + docker deps)

Starts Postgres + Chroma + Redis + SearXNG in Docker, and runs the backend + frontend on your host machine.

```bash
cp .env.example .env
just dev
```

Optional deps:

```bash
# Minimal deps (no web search):
just DEV_DEPS_OPTIONALS="storage redis" dev

# Add local Ollama:
just DEV_DEPS_OPTIONALS="storage redis searxng ollama" dev
```

## No-docker dev (SQLite + embedded Chroma)

## Backend (FastAPI)

```bash
cd backend/py
uv sync
just db-init
just dev
```

API docs (Scalar): `http://127.0.0.1:8032/v1/codev/openapi-ui/scalar`

## Frontend (Vite + React)

```bash
cd frontend/web
pnpm install
pnpm dev
```

## Workspace tips

- Command palette: `Ctrl+K`
- Shortcut help: `Ctrl+?`
- Sources: upload `.txt`, `.md`, `.markdown`, or `.pdf` files in the Sources panel.
- Health / diagnostics: use the header button to inspect `/health/dependencies`

## Dev workflow tips

- Backend tests: `cd backend/py && just test`
- Frontend tests: `cd frontend/web && pnpm test`
- If backend OpenAPI changes:
  - Sync schema + regenerate client: `pnpm -C frontend/web run api:sync`
  - Or from repo root: `just api-sync`

## Docker Compose (prod-like)

See `Deployment` for the canonical stack.
