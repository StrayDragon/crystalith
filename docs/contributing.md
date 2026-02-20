# Contributing

## Repo structure

- `backend/py/`: FastAPI service (app in `backend/py/src/crystalith/`)
- `frontend/web/`: Vite + React UI
- `config/`: runtime config (`app.yaml`) and schema (`app.schema.json`)
- `openspec/`: specs + change tracking
- `sdk/`: generated SDKs + generator configs

## Development

Backend:

```bash
cd backend/py
uv sync
just dev
```

Frontend:

```bash
cd frontend/web
pnpm install
pnpm dev
```

## Tests

```bash
cd backend/py && just test
cd frontend/web && pnpm test
```

## OpenAPI / generated clients

If you change backend APIs:

```bash
pnpm -C frontend/web run api:sync
```

## Commit messages

Use short type prefixes, e.g.:

- `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:`
