## 1. Backend（Ruff：A/ARG/DTZ）

- [x] 1.1 在 `backend/py/pyproject.toml` 中扩展 Ruff 规则集：启用 `A/ARG/DTZ`，并为 `**/tests/**/*.py` 增加 `ARG*` 的 per-file ignore
- [x] 1.2 在主分支基线修复新增违规（优先修复非测试代码，再处理测试代码中的 A/DTZ）
- [x] 1.3 为确有必要的例外添加最小范围 ignore/局部 disable，并在代码中写明原因

## 2. Frontend（oxlint：suspicious + perf）

- [x] 2.1 更新 `frontend/web` 的 lint 入口：对增量与全量 lint 启用 `-D suspicious -D perf`，并放行 `react-in-jsx-scope`
- [x] 2.2 修复启用后在主分支基线出现的违规（优先：`no-array-index-key`、`no-shadow`、`no-await-in-loop`、`no-unassigned-import`）

## 3. Verification（本地与 CI 一致）

- [x] 3.1 Backend：`cd backend/py && uv run ruff check .`（确保基线为 0）
- [x] 3.2 Backend：`cd backend/py && just test` 与 `cd backend/py && just packages-test`
- [x] 3.3 Frontend：`cd frontend/web && pnpm run lint` 与 `pnpm run lint:all`
- [x] 3.4 Frontend：`cd frontend/web && pnpm typecheck && pnpm test && pnpm run format:check`

## 4. Spec & Closeout

- [x] 4.1 在实现完成后将本变更的增量 spec 同步回 `openspec/specs/quality-and-regression/spec.md`
- [x] 4.2 将变更归档到 `openspec/changes/archive/`（保留可追溯的提案/设计/任务与验证记录）

## Verification Results (2026-03-17)

- Backend: `cd backend/py && ruff check .` ✅
- Backend: `cd backend/py && just test` ✅
- Backend: `cd backend/py && just packages-test` ✅
- Frontend: `cd frontend/web && pnpm run lint` ✅
- Frontend: `cd frontend/web && pnpm run lint:all` ✅
- Frontend: `cd frontend/web && pnpm run format:check` ✅
- Frontend: `cd frontend/web && pnpm typecheck` ✅
- Frontend: `cd frontend/web && pnpm test` ✅
