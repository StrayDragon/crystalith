# Getting Started

## Prerequisites

- Python 3.12
- Node 20 + pnpm
- `uv` (Python package manager)

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

## Dev workflow tips

- Backend tests: `cd backend/py && just test`
- Frontend tests: `cd frontend/web && pnpm test`
- If backend OpenAPI changes:
  - Sync schema + regenerate client: `pnpm -C frontend/web run api:sync`
  - Or from repo root: `just api-sync`

## Docker Compose (prod-like)

See `Deployment` for the canonical stack.
