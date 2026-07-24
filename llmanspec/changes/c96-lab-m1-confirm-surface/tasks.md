# Tasks: c96-lab-m1-confirm-surface

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r449 + scenarios
- [x] `llman sdd validate c96-lab-m1-confirm-surface --strict --no-interactive`

## Apply（`llman-sdd-apply` · 全程 main）

### 1. confirmKind 文案与动作条

- 1.1 `ResearchLabPage` / 确认条组件：`budget` vs `expand_branch` 分化 copy
- 1.2 暴露 `continue`、`finish_report`、`approve_branch`、`skip_branch`（expand_branch 时后两者可见）
- 1.3 Vitest：两种 confirmKind 的文案与可见按钮集合

### 2. 分支高亮

- 2.1 `useEdenLabController`：进入 `awaiting_confirm` 时根据 `confirmBranchNodeId` 设置 `highlightedNodeIds`
- 2.2 `LabGraph` 已消费高亮 — 补集成测试或 Vitest prop 断言

### 3. confirm API 与错误

- 3.1 `skip_branch` → `confirmResearchRun({ action: 'skip_branch', branchNodeId })`
- 3.2 `RESEARCH_BUDGET` / `RESEARCH_INVALID_STATE` → 可见内联/toast（对齐 r410）
- 3.3 Vitest：skip_branch 请求体；错误码映射

### 4. 验证

- 4.1 `cd apps/web && bun run test:ci`（相关用例）+ `bun typecheck`
- 4.2 `llman sdd validate c96-lab-m1-confirm-surface --strict --no-interactive`
