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
- `backend/py/`: FastAPI service with SQLAlchemy async models and local packages.
  - `src/crystalith/`: main app code (`api`, `ai`, `db`, `ingestion`, `config`).
  - `packages/`: shared libraries used by the backend.
  - `tests/` and `packages/*/tests/`: pytest suites.
- `frontend/web/`: Vite + React + TypeScript frontend.
  - `src/app/`: app entry, App shell, global styles.
  - `src/features/`: feature modules with colocated components/styles (e.g. `workspace/`).
  - `src/shared/`: shared types, utilities, and UI primitives.
  - `public/`: static assets.
- `config/`: runtime config (`app.yaml`) and generated schema (`schema.json`).
- `docs/`: local dev + deployment notes.
- `openspec/`: change proposals and planning artifacts.

## Build, Test, and Development Commands
Backend (run from repo root unless noted):
- `cd backend/py && uv sync` — install Python dependencies with uv.
- `uv run --project backend/py uvicorn crystalith.app:create_app --factory --host 127.0.0.1 --port 8000` — start the API server.
- Optional DB init: see `docs/local-dev-deploy.md` for the `create_all` SQLite command.
- `cd backend/py && uv run pytest` — run backend tests.

Frontend:
- `cd frontend/web && pnpm install` — install JS deps.
- `pnpm dev` — Vite dev server (port 3000, proxy targets `http://127.0.0.1:8032`).
- `pnpm run build` — production build.
- `pnpm preview` — preview production build.
- `pnpm test` — Vitest runner.

## Coding Style & Naming Conventions
- Python: 4-space indentation, type hints where practical, async/await for I/O paths; keep modules cohesive under `crystalith/*`.
- TypeScript/React: use `.ts`/`.tsx`, PascalCase for components, camelCase for helpers; co-locate feature components and `.css` under `src/features/...` when appropriate.

## Testing Guidelines
- Backend uses pytest + pytest-asyncio; name files `test_*.py`.
- Frontend uses React Testing Library; keep tests alongside components (e.g., `frontend/web/src/App.test.js`).

## Commit & Pull Request Guidelines
- History mixes conventional prefixes (`feat: ...`) and sentence-style subjects. Use a concise subject, and keep it consistent within a PR.
- Include context for API/UI changes, relevant test commands, and OpenSpec task references when applicable.

## Security & Configuration Tips
- Store secrets only in `config/app.yaml`; never commit real keys. `config/schema.json` is generated.
- For proposal-style or large architectural changes, consult `openspec/AGENTS.md` first.
