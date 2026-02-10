## Why

当前后端/前端多个核心模块已发展为千行级单文件，单文件承载过多职责（schemas + 路由 + 业务逻辑 + 数据/向量写入 + UI 状态与交互），导致评审困难、冲突频繁、单测粒度难以下沉；同时 TaskQueue 在 waiter 生命周期与停机行为上存在潜在泄漏/悬挂任务风险；生产后端镜像目前通过“安装后卸载依赖”的方式瘦身，维护成本高且容易误删依赖；另外 `pnpm-workspace.yaml` 被 `.gitignore` 忽略导致不同开发者 clone 后行为不一致。以上问题在近期功能持续叠加后将显著拖慢迭代并增加运行风险，因此需要一次面向可维护性的整理。

## What Changes

- 后端：拆分 `crystalith/features/sources/api.py` 等超大 API 模块到更细粒度子模块（tags/search/ingest/qa/summary/batch 等），统一 Pydantic schema 定义位置；保持对外路由路径与 OpenAPI 合约不变。
- 前端：拆分 `features/workspace/layout/WorkspaceLayout.tsx` 与若干超大 panel（sources/refine/research/studio 等），提取纯展示组件与领域 hooks，降低单文件改动半径。
- 后端：修复 `TaskQueue` 的 waiter 生命周期与停机行为（追踪 in-flight tasks，stop 时 cancel/await），避免长跑内存增长与关闭时悬挂任务。
- 部署：后端 Docker 镜像构建改为使用 `uv sync --no-install-package chromadb` 等方式避免“先装再卸”的瘦身手法，减少维护风险并稳定镜像体积。
- 仓库：移除 `.gitignore` 中对 `pnpm-workspace.yaml` 的忽略并纳入版本控制，保证 clone 后行为一致。

## Capabilities

### New Capabilities

- `background-task-queue`: 后端后台任务队列的生命周期与资源管理（enqueue/worker/stop/waiters）行为规范。

### Modified Capabilities

- `backend-module-structure`: 增补关于 feature API/schemas/service/repo 分层与“超大模块拆分/导入规范”的要求。
- `frontend-module-structure`: 增补关于 workspace 大组件拆分、容器/展示组件边界与可测试单元下沉的要求。
- `deployment`: 增补关于生产镜像依赖 profile（不依赖卸载清单、按运行模式选择依赖）的要求。

## Impact

- 后端：`backend/py/src/crystalith/features/sources/**`、`backend/py/src/crystalith/features/tasks/queue.py`、`backend/py/src/crystalith/web/routers.py`（若路由聚合方式调整）。
- 前端：`frontend/web/src/features/workspace/layout/**` 与相关 domains 目录。
- 部署/依赖：`dockers/backend/Dockerfile`（主要）、必要时涉及 `backend/py/pyproject.toml`（若最终选择把依赖改为可选 extras）。
- 仓库配置：`.gitignore`、`frontend/web/pnpm-workspace.yaml`。
- 非目标：不引入新的 CI 门禁；不改变对外 API 合约；不处理密钥泄露与历史清理（单独议题）。
