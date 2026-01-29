## Why
当前前端 `features/` 只有 `workspace` 一个大域，内部包含大量跨域组件与逻辑，导致模块边界不清晰、重构风险高。关键文件体量过大（如 `SlidesStudioDialog.tsx`、`RefinePanel.tsx`、`ResearchDetailPanel.tsx` 等超过千行），`WorkspaceContext` 统一管理 notebooks/sources/sessions/chat/outputs/refine 等多域状态，改动时容易牵一发动全身。

同时，现有 E2E 覆盖缺少对长耗时交互（对话/深入研究/输出生成等）的稳定性保障。由于前端单测覆盖有限，缺乏足够“行为级”保护网会放大结构性重构的风险。

## What Changes
- **E2E 基线先行（live-only）**：基于现有 Playwright 建立全流程 live E2E 覆盖与长耗时等待策略，使用 `./scripts/run-e2e.sh` 作为重构验证入口。
- **核心逻辑单测补齐**：为 workspace 的 reducer、关键 hooks 与关键 utils 增加 Vitest 覆盖，降低重构风险。
- **Workspace 内部分域重构**：保留顶层 `features/workspace`，在内部引入按子域聚合的结构（与后端域名尽量对齐：notebooks/sessions/messages/analysis/sources/outputs/refine/studio/research 等），并建立 workspace 层级的 shared 目录，减少跨域耦合。
- **无兼容层迁移**：移动后立即更新 import 路径，不保留 re-export/别名，采用“小步迁移 + 每步验证”的方式降低风险。

## Impact
- 受影响规范：新增 `frontend-module-structure` 规范。
- 受影响代码：`frontend/web/src/features/workspace/**`、`frontend/web/src/shared/**`、`frontend/web/e2e/**`、`frontend/web/playwright.config.ts`、`scripts/run-e2e.sh`。
- 风险：结构迁移导致 UI 或行为回归；通过 E2E 基线 + 分阶段验证降低风险。
