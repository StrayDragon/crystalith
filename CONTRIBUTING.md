# Contributing

Thanks for your interest in contributing to Crystalith.

If you want a more detailed walkthrough, see `docs/doc/contributing.md`.

## Quick start (local dev)

Prerequisites:
- Python 3.12
- Node 20 + `pnpm`
- `uv` (Python package manager)
- Docker (recommended for local deps)
- `overmind` (for local/hybrid profiles)

Recommended (host hot reload + docker deps):

```bash
cp .env.example .env
just upsert-env-configs
just up                   # default: hybrid profile
```

Backend only (no Docker):

```bash
cd backend/py
uv sync
just db-init
just dev
```

Frontend only:

```bash
cd frontend/web
pnpm install
pnpm dev
```

## Tests

Backend:

```bash
cd backend/py && just test
```

Frontend:

```bash
cd frontend/web && pnpm test
cd frontend/web && pnpm run typecheck
```

## Repo structure

- `backend/py/`: FastAPI service (app code in `backend/py/src/crystalith/`)
- `backend/py/packages/`: workspace Python libraries used by the service
- `frontend/web/`: Vite + React UI
- `config/`: runtime config (`app.yaml`) and generated schema (`app.schema.gen.json`)
- `openspec/`: specs + change tracking
- `sdk/`: generated SDKs + generator configs

## OpenAPI / generated clients

If you change backend APIs, sync the committed schema + regenerate the TS client:

```bash
pnpm -C frontend/web run api:sync
# or:
just api-sync
```

## Specs / change workflow

This repo uses OpenSpec for change tracking:
- Canonical specs live under `openspec/specs/`
- In-progress changes live under `openspec/changes/`

## Commit messages

Use short type prefixes:
- `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:`

## Pull requests

Please include:
- What changed and why
- Linked issue/spec (if applicable)
- Test results (commands + outcome)
- Screenshots/GIFs for UI changes (if applicable)
