# Contributing

## Repo structure

- `backend/py/`: FastAPI service (app in `backend/py/src/crystalith/`)
- `frontend/web/`: Vite + React UI
- `config/`: runtime config (`app.yaml`) and schema (`app.schema.gen.json`)
- `openspec/`: specs + change tracking
- `sdk/`: generated SDKs + generator configs

## Repo entrypoints

See `justfile` for repo entrypoints (run `just -l`).

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

Optional Slidev preview service during host development:

```bash
just dev-slidev
```

Notes:
- Frontend dev/build/test/typecheck commands auto-initialize `frontend/web/vendor/rivu` when needed.
- Manual fallback: `just rivu-submodule-update`

## Tests

```bash
cd backend/py && just test
cd frontend/web && pnpm test
```

## Lint / contract checks

```bash
cd backend/py && just lint
cd backend/py && just contract
cd frontend/web && pnpm run lint
cd frontend/web && pnpm run format:check
```

Notes:
- `pnpm -C frontend/web run lint` runs incremental `oxlint` on changed frontend source files (default base: `origin/main`, with local fallback when unavailable).
- `pnpm -C frontend/web run lint:all` runs full `oxlint` on `frontend/web/src` and surfaces repository-baseline warnings without requiring immediate cleanup.
- `pnpm -C frontend/web run format` applies `oxfmt`; use `pnpm -C frontend/web run format:check` in verification flows.

## Config schema

If you change config settings models, regenerate `config/app.schema.gen.json`:

```bash
cd backend/py && just config-schema
```

## Eval / regression harness

Generate an offline JSON + Markdown report (no network / real model calls by default):

```bash
cd backend/py && just llm-eval
```

To compare runs, keep the generated `backend/py/llm_eval_reports/llm_eval_report.json` as a baseline and diff it
against a new run.

## OpenAPI / generated clients

If you change backend APIs:

```bash
pnpm -C frontend/web run api:sync
```

## Commit messages

Use short type prefixes, e.g.:

- `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:`
