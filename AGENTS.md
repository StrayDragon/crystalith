# Repository Guidelines

## Project Structure & Module Organization
- `backend/py/` hosts the FastAPI service; app code lives in `backend/py/src/crystalith/` and tests in `backend/py/tests/`.
- `backend/py/packages/` contains workspace libraries (e.g., `cl-logs`, `cl-fastapix`), each with its own `pyproject.toml` and `tests/`.
- `frontend/web/` is the Vite + React + TypeScript UI; source is in `frontend/web/src/`, assets in `frontend/web/public/`.
- `config/` stores runtime config (`app.yaml`) and the generated schema (`app.schema.gen.json`).
- `openspec/` contains specification/change-tracking docs; consult it for spec-driven work.

## Build, Test, and Development Commands
Unified entry (from repo root):
- `just up` starts with default profile (hybrid: Docker deps + host hot reload).
- `just up local` starts without Docker (SQLite + embedded Chroma).
- `just up docker` starts Docker Compose deployment.
- `just up full` starts full Docker Compose with all overlays.
- `just down` / `just status` / `just logs` manage the running profile.
- `just upsert-env-configs` initializes `.env` and `config/secrets.yaml` from shell env vars.
- `just cleanup` detects stale artifacts from old workflows (dry-run; `--apply` to execute).

Backend (from repo root):
- `cd backend/py && uv sync` installs Python deps.
- `cd backend/py && just dev` runs the API server (uvicorn wrapper).
- `cd backend/py && just test` runs pytest.
- `cd backend/py && just db-init` creates local SQLite tables.
- `cd backend/py && just config-schema` regenerates `config/app.schema.gen.json`.
- `cd backend/py && just packages-test` runs workspace package tests.
- `cd backend/py && just llm-eval` runs the local eval harness.
- `cd backend/py && just embedding-cache-bench` runs the Redis embedding cache benchmark.

Frontend:
- `cd frontend/web && pnpm install` installs JS deps.
- `cd frontend/web && pnpm dev` starts the Vite dev server.
- `cd frontend/web && pnpm test` runs Vitest.
- `cd frontend/web && pnpm run lint` runs incremental `oxlint` against changed frontend source files.
- `cd frontend/web && pnpm run lint:all` runs full `oxlint` on the frontend source tree.
- `cd frontend/web && pnpm run format` applies `oxfmt` to frontend source/config files.
- `cd frontend/web && pnpm run format:check` verifies frontend formatting without writing changes.
- `cd frontend/web && pnpm run build` creates a production build.
- `cd frontend/web && pnpm typecheck` runs TypeScript typechecking.

Tip: `just -l` lists available tasks in each directory.

## Coding Style & Naming Conventions
- Python: 4-space indentation; prefer high-coverage type hints; minimize `Any`; avoid dynamic attribute access (`getattr`, `hasattr`, `__getattr__`); `snake_case` for functions/vars, `PascalCase` for classes.
- TypeScript/React: 2-space indentation; `PascalCase` components; hooks named `useX`.
- CSS/Tailwind: keep global styles in `frontend/web/src/app/index.css`; feature styles live alongside components.
- No repo-wide formatter is configured outside `frontend/web`; frontend uses `oxfmt`. Match existing style elsewhere and avoid unrelated reformatting.
- If backend OpenAPI changed, run `cd frontend/web && pnpm run api:sync` and verify.

## Testing Guidelines
- Backend uses `pytest` + `pytest-asyncio`; tests live in `backend/py/tests/` and `backend/py/packages/*/tests/` with `test_*.py` names.
- Frontend uses Vitest + React Testing Library; colocate tests under `frontend/web/src/` with `*.test.tsx`.
- Run targeted tests for the areas you change and note any manual checks in PRs.

## Commit & Pull Request Guidelines
- Commit messages use short type prefixes: `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:` (optionally with scope like `feat(backend):`).
- Keep subjects short, imperative, and focused on one change.
- PRs should include a clear description, linked issue/spec (if any), test results, and screenshots/GIFs for UI changes.

## Doc Governance (Generated Files + Injected Blocks)
- Files named `*.gen.*` are generated; do not edit by hand. Update the SSOT and run the generator entrypoint (for docs: `just gen-docs`).
- Markdown blocks wrapped by `<!-- BEGIN AUTOGEN:<id> --> ... <!-- END AUTOGEN:<id> -->` are injected; do not edit block contents by hand. Regenerate via `just gen-docs`.
- `CLAUDE.md` MUST be a symlink to `AGENTS.md` (single-source collaboration instructions).

## Security, Configuration, and Spec Workflow
- Local config lives in `config/app.yaml`; `config/app.schema.gen.json` is generated for YAML validation. Never commit API keys or tokens.
- If config shape changes, describe required keys in the PR.
- When work involves a proposal/plan, new features, breaking changes, or ambiguous requirements, read `openspec/AGENTS.md` for spec and change-tracking conventions.
