<!-- LLMANSPEC:START -->
# LLMAN Spec-Driven Development

This project uses llman SDD. Read `llmanspec/config.yaml` for project context and rules.

Use `/llman-sdd-onboard` to get started, then `/llman-sdd-*` skills for workflow.

Keep this managed block so `llman sdd update` can refresh it.
<!-- LLMANSPEC:END -->

# Repository Guidelines

## Project Structure & Module Organization
- `backend/py/` hosts the FastAPI service; see `backend/AGENTS.md` for detailed module layout, integration, and core logic.
- `frontend/web/` is the Vite + React + TypeScript UI; see `frontend/AGENTS.md` and `frontend/web/AGENTS.md` for domain details and Layer system.
- `config/` stores runtime config SSOT; see `config/AGENTS.md` for overlay conventions, template rendering, and schema governance.
- `llmanspec/` contains specification/change-tracking docs (migrated from `openspec/`); consult `llmanspec/config.yaml` for spec-driven workflow.

## Build, Test, and Development Commands
Unified entry (from repo root):
- `just up` starts with default profile (hybrid: Docker deps + host hot reload).
- `just up local` starts without Docker (SQLite + embedded Chroma).
- `just up docker` / `just up full` for Docker Compose deployments.
- `just down` / `just status` / `just logs` manage the running profile.
- `just upsert-env-configs` initializes `.env` and `config/secret.env` from shell env vars.
- `just cleanup` detects stale artifacts (dry-run; `--apply` to execute).

Backend: see `backend/AGENTS.md` for dev/run/test details. Quick commands:
- `cd backend/py && uv sync` — install Python deps.
- `cd backend/py && just dev` — run API server.
- `cd backend/py && just test` — run pytest.
- `cd backend/py && just db-init` — create local SQLite tables.

Frontend: see `frontend/AGENTS.md` and `frontend/web/AGENTS.md` for full command reference. Quick commands:
- `cd frontend/web && pnpm install` — install JS deps.
- `cd frontend/web && pnpm dev` — start Vite dev server.
- `cd frontend/web && pnpm test` — run Vitest.
- `cd frontend/web && pnpm typecheck` — TypeScript typechecking.

Tip: `just -l` lists available tasks in each directory.

## Coding Style & Naming Conventions
- Python: 4-space indentation; prefer high-coverage type hints; minimize `Any`; avoid dynamic attribute access (`getattr`, `hasattr`, `__getattr__`); `snake_case` for functions/vars, `PascalCase` for classes.
- TypeScript/React: 2-space indentation; `PascalCase` components; hooks named `useX`.
- CSS/Tailwind: global styles in the frontend app entry; feature styles live alongside components.
- **Layer System**: Never hardcode z-index values; use the unified Layer system (see `frontend/web/AGENTS.md` for levels and usage).
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
- When work involves a proposal/plan, new features, breaking changes, or ambiguous requirements, read `llmanspec/config.yaml` for spec and change-tracking conventions.
