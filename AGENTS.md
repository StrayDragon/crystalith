<!-- OPENSPEC:START -->
# OpenSpec 说明文档

这些说明文档适用于在此项目中工作的 AI 助手。

当请求满足以下条件时，始终打开 `@/openspec/AGENTS.md`：
- 提及规划或提案（诸如 proposal、spec、change、plan 之类的词）
- 引入新功能、破坏性变更、架构转变或大型性能/安全工作
- 听起来模棱两可，您需要权威规范才能进行编码

使用 `@/openspec/AGENTS.md` 了解：
- 如何创建和应用变更提案
- 规范格式和约定
- 项目结构和指南

保持此托管块，以便 'openspec update' 可以刷新说明文档。

<!-- OPENSPEC:END -->

# Repository Guidelines

## Project Structure & Module Organization
- `backend/py/` houses the FastAPI service, with app code in `backend/py/src/crystalith/` and tests in `backend/py/tests/`.
- `backend/py/packages/` contains workspace libraries (e.g., `cl-logs`, `cl-fastapix`), each with its own `pyproject.toml` and `tests/`.
- `frontend/web/` is the Vite + React + TypeScript UI; source lives in `frontend/web/src/`, assets in `frontend/web/public/`.
- `config/` stores runtime configuration (`app.yaml`) and the generated schema (`schema.json`).
- `openspec/` contains specification and change-tracking docs; use it when working on spec-driven changes.

## Build, Test, and Development Commands
Backend (from repo root):
```bash
cd backend/py
uv sync                # install deps
just dev               # run API server (uvicorn wrapper)
just test              # run pytest
just db-init           # create local SQLite tables
```
Frontend:
```bash
cd frontend/web
pnpm install
pnpm dev               # local dev server
pnpm test              # vitest runner
pnpm run build         # production build
pnpm preview           # serve build locally
```
Tip: `just -l` lists available tasks in each directory.

## Coding Style & Naming Conventions
- Python: 4-space indentation, type hints encouraged, `snake_case` for functions/vars, `PascalCase` for classes.
- TypeScript/React: 2-space indentation, `PascalCase` components, hooks named `useX`, tests as `*.test.tsx`.
- CSS/Tailwind: keep global styles in `frontend/web/src/app/index.css`; feature styles live alongside components.
- No repo-wide formatter is configured; match existing style and avoid unrelated reformatting.

## Testing Guidelines
- Backend uses `pytest` + `pytest-asyncio`; tests live in `backend/py/tests/` and `backend/py/packages/*/tests/` with `test_*.py`.
- Frontend uses Vitest and React Testing Library; colocate tests under `frontend/web/src/`.
- Run targeted tests for the areas you change and note any manual checks in the PR.

## Commit & Pull Request Guidelines
- Commit messages use short type prefixes like `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:` with optional scope (e.g., `feat(backend): add ...`).
- Keep subjects short, imperative, and focused on one change.
- PRs should include a clear description, linked issue/spec (if any), test results, and screenshots/GIFs for UI changes.

## Configuration & Secrets
- Local config is `config/app.yaml`; `config/schema.json` is generated for YAML validation.
- Never commit API keys or tokens. If config shape changes, describe required keys in the PR.
