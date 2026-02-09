## 1. Preparation

- Notes (for 1.1–1.3):
  - Backend sources API split targets:
    - `api_schemas.py`: all request/response models & enums
    - `api_common.py`: shared helpers (cache invalidation, parser resolution, SourceRead conversion, common DB helpers)
    - `api_tags.py`: `/tags` CRUD + source/tag bindings
    - `api_search.py`: `/search`
    - `api_ingest.py`: `/extractors`, `/from-url`, upload `POST /` (ingestion)
    - `api_sources.py`: list sources, chunks, delete/batch delete, (re-)embed endpoints
    - `api_summary.py`: `/{source_id}/summary`
    - `api_qa.py`: `/{source_id}/qa` + convert
    - `api.py`: thin router that includes sub-routers; imports at top only
  - Frontend safe extraction batch:
    - `features/workspace/layout/components/`: `WorkspacePanelShell`, `WorkspaceResizeHandle` (pure UI)
    - `domains/sources/components/`: split `SourcesPanel` into smaller presentation components (search header, dynamic area, filter bar, list)
  - Stability boundary:
    - Backend: keep route paths + handler names stable to avoid OpenAPI diff
    - Frontend: keep `WorkspaceLayout` export and `SourcesPanel` props stable; only internal extraction

- [x] 1.1 盘点 `backend/py/src/crystalith/features/sources/api.py` 的端点分组（tags/search/ingest/qa/summary/batch 等）并确定拆分目标文件名
- [x] 1.2 盘点前端 workspace 超大组件（WorkspaceLayout + sources/refine/research/studio 等）并确定第一批可安全抽取的子组件清单（纯 UI / 无副作用）
- [x] 1.3 确认本次变更的“对外不变”边界：路由路径、OpenAPI schema、前端对外导出组件接口（记录在变更说明中）

## 2. Backend: Sources API decomposition

- [x] 2.1 将 sources 端点相关的 Pydantic models 迁移到 `features/sources/api_schemas.py`（或按模块拆分），并消除 `SourceRead` 等重复定义（保留单一导出来源）
- [x] 2.2 将 tags 相关端点与 helper 迁移到 `features/sources/api_tags.py`（保持路由路径不变）
- [x] 2.3 将 search/from-url/upload 等导入与解析端点迁移到 `features/sources/api_ingest.py`（保持路由路径不变）
- [x] 2.4 将 summary/qa/convert 相关端点迁移到 `features/sources/api_qa.py` / `features/sources/api_summary.py`（保持路由路径不变）
- [x] 2.5 将 `features/sources/api.py` 收敛为薄入口：仅包含 router 定义、子模块聚合与少量 glue code；同时修复“非顶层 import”问题（import 全部置顶）
- [x] 2.6 后端回归：`cd backend/py && just test`；并执行 `cd backend/py && uv run scripts/api_schema.py check -s ../../frontend/web/openapi.json`

## 3. Frontend: Workspace maintainability refactor

- [x] 3.1 从 `WorkspaceLayout` 抽取纯展示子组件（Header/Toolbar/PanelShell 等）到 `features/workspace/layout/components/`，保持 `WorkspaceLayout` props/导出不变
- [x] 3.2 对至少一个超大 domain panel（优先 sources）执行“容器/展示”拆分：副作用集中到 domain hook，展示组件以 props 驱动
- [x] 3.3 前端回归：`cd frontend/web && pnpm test` 与 `pnpm run build`（确保拆分不引入编译/测试回归）

## 4. Backend: TaskQueue lifecycle fixes

- [x] 4.1 调整 TaskQueue waiter 生命周期：移除 enqueue 时 waiter 预创建，改为 `wait_for_completion` lazy 创建；任务完成/取消时仅在 waiter 存在时通知
- [x] 4.2 追踪 in-flight worker tasks：在 `stop_worker` 中取消并 await，确保 stop 返回后无悬挂后台任务
- [x] 4.3 增加单测覆盖关键边界：未 wait 的任务不导致 waiter 增长；stop_worker 在任务执行中可安全收敛（tests 放在 `backend/py/tests/` 对应模块）

## 5. Deployment: uv-based dependency profile (remove uninstall list)

- [x] 5.1 更新 `dockers/backend/Dockerfile`：使用 `uv sync --no-install-package chromadb`（保留 `--frozen --no-dev --no-editable`）并移除卸载清单步骤
- [x] 5.2 验证生产 compose 的运行模式：确保 `CHROMA_HOST` 为非 localhost 值时走 HTTP Chroma 路径，不依赖 `chromadb` Python 包
- [x] 5.3 构建验证（本地/CI）：`docker compose -f docker-compose.prod.yml build api` 并通过 healthcheck 启动

## 6. Repo reproducibility: pnpm-workspace.yaml

- [x] 6.1 移除 `.gitignore` 中对 `pnpm-workspace.yaml` 的忽略规则
- [x] 6.2 将 `frontend/web/pnpm-workspace.yaml` 纳入版本控制（必要时补充注释说明其用途与作用域）

## 7. Final verification

- [x] 7.1 后端：`just test` + OpenAPI schema check 通过（无意外 schema diff）
- [x] 7.2 前端：`pnpm test` + `pnpm run build` 通过
- [x] 7.3 手工 smoke：`overmind s` 启动后，workspace 基本流程可用（sources 列表/上传/删除、refine 触发队列、research 面板打开）
  - Note: 本次在 Codex sandbox 中 `overmind` 依赖的 `tmux` 无法 fork（Permission denied），已改为直接启动后端+前端并用 devtools 验证 UI 基本流程。
