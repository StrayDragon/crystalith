# Repository Guidelines

## Project Structure & Module Organization
- `frontend/web/` is the Vite + React + TypeScript UI; source code lives in `frontend/web/src/`, static assets in `frontend/web/public/`.
- `backend/py/` contains the FastAPI service with app code in `backend/py/src/crystalith/` and tests in `backend/py/tests/`.
- `backend/py/packages/` hosts workspace Python libraries, each with its own `pyproject.toml` and `tests/`.
- `config/` stores runtime config (`config/app.yaml`) and the generated schema (`config/schema.json`).

## Build, Test, and Development Commands
Frontend (from repo root):
- `cd frontend/web && pnpm install` — install dependencies.
- `pnpm dev` — start the Vite dev server.
- `pnpm test` — run Vitest and React Testing Library.
- `pnpm run build` — create a production build.
- `pnpm preview` — serve the production build locally.

Backend (from repo root):
- `cd backend/py && uv sync` — install Python deps.
- `just dev` — run the API server (uvicorn wrapper).
- `just test` — run pytest.

Tip: `just -l` lists available tasks in each directory.

## Coding Style & Naming Conventions
- TypeScript/React: 2-space indentation; components use `PascalCase`; hooks are `useX`; tests named `*.test.tsx`.
- Python: 4-space indentation; `snake_case` for functions/vars, `PascalCase` classes.
- CSS/Tailwind: global styles in `frontend/web/src/app/index.css`; feature styles live alongside components.
- No repo-wide formatter is configured; match existing style and avoid unrelated reformatting.

## Testing Guidelines
- Frontend uses Vitest + React Testing Library; colocate tests under `frontend/web/src/`.
- Backend uses `pytest` + `pytest-asyncio`; tests live in `backend/py/tests/` and `backend/py/packages/*/tests/`.
- Run targeted tests for changed areas and note any manual checks in the PR.

## Commit & Pull Request Guidelines
- Commit messages use short type prefixes like `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:` with optional scopes (e.g., `feat(frontend): add login form`).
- PRs should describe the change, link relevant issue/spec, include test results, and attach screenshots/GIFs for UI updates.

## Configuration & Security Notes
- Local config lives in `config/app.yaml`; never commit API keys or tokens.
- If you change config shape, update documentation and include required keys in the PR.

## Agent-Specific Instructions
- If a task involves proposals/plans, new features, or ambiguous requirements, consult `openspec/AGENTS.md` for spec workflow and conventions before coding.
