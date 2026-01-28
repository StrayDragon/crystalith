## 1. E2E Baseline (先于重构)
- [x] 1.1 确认 Playwright 作为唯一 E2E 框架（沿用现有配置）并定义 live-only profile。
- [x] 1.2 为关键 UI 元素补充稳定的选择器策略（优先 aria 语义，必要时 data-testid）。
- [x] 1.3 增加 E2E 用例：workspace 首屏加载与三栏布局（live）。
- [x] 1.4 增加 E2E 用例：notebook/session 切换（live）。
- [x] 1.5 增加 E2E 用例：sources 搜索队列与批量添加（live）。
- [x] 1.6 增加 E2E 用例：source 详情与内部问答（live）。
- [x] 1.7 增加 E2E 用例：chat 发送/流式输出（live）。
- [x] 1.8 增加 E2E 用例：studio 工具与 slides 配置（live）。
- [x] 1.9 增加 E2E 用例：graph 视图打开/关闭（live）。
- [x] 1.10 增加长耗时等待策略（expect.poll/更长 timeout）。
- [x] 1.11 运行并记录 `./scripts/run-e2e.sh` 结果。

## 2. Unit Test Baseline (先于重构)
- [x] 2.1 为 `workspaceReducer` 添加 Vitest 单测（状态转换与边界场景）。
- [x] 2.2 为核心 hooks 添加 Vitest 单测（如 useSources/useChat/useResearch/useRefine/useOutputQueue 的关键行为）。
- [x] 2.3 为关键 utils 添加 Vitest 单测（消息归一化、引用处理、队列处理等）。
- [x] 2.4 运行并记录 `cd frontend/web && pnpm test` 结果。

## 3. Workspace 内部分域重构（小步验证）
- [x] 3.1 定义目标目录结构（`features/workspace/domains/<domain>`、`features/workspace/shared`、`features/workspace/app`/`layout`），域名尽量对齐后端（notebooks/sessions/messages/analysis/sources/outputs/refine/studio/research）。
- [x] 3.2 盘点可抽离的共享组件（dialog header/empty state/toolbar 等），并迁移到 `features/workspace/shared` 或 `src/shared`。
- [x] 3.3 迁移 Workspace 入口与布局相关组件到 `app/` 或 `layout/`（保持行为不变）。
- [x] 3.4 迁移 notebooks 子域并执行 `pnpm test` + `./scripts/run-e2e.sh`。
- [x] 3.5 迁移 sessions 子域并执行 `pnpm test` + `./scripts/run-e2e.sh`。
- [x] 3.6 迁移 messages 子域并执行 `pnpm test` + `./scripts/run-e2e.sh`。
- [x] 3.7 迁移 analysis 子域（含 graph）并执行 `pnpm test` + `./scripts/run-e2e.sh`。
- [x] 3.8 迁移 sources 子域并执行 `pnpm test` + `./scripts/run-e2e.sh`。
- [x] 3.9 迁移 outputs 子域并执行 `pnpm test` + `./scripts/run-e2e.sh`。
- [x] 3.10 迁移 refine 子域并执行 `pnpm test` + `./scripts/run-e2e.sh`。
- [x] 3.11 迁移 studio 子域并执行 `pnpm test` + `./scripts/run-e2e.sh`。
- [x] 3.12 迁移 research 子域并执行 `pnpm test` + `./scripts/run-e2e.sh`。
- [x] 3.13 整理 types/utils：优先移动到对应子域，其次放入 `features/workspace/shared`，跨 feature 复用放入 `src/shared`。
- [x] 3.14 更新 import 路径并移除旧路径（不保留 re-export/别名）。

## 4. Documentation & Validation
- [x] 4.1 更新前端结构说明（如 `frontend/web/README.md` 或 `frontend/web/AGENTS.md`）。
- [x] 4.2 `openspec validate refactor-frontend-layout-260129 --strict --no-interactive`。
