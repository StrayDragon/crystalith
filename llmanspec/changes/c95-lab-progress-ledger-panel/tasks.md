# Tasks: c95-lab-progress-ledger-panel

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r448 + scenarios
- [x] `llman sdd validate c95-lab-progress-ledger-panel --strict --no-interactive`

## Apply（`llman-sdd-apply` · 全程 main）

### 1. API client

- 1.1 `edenResearchApi.listProgress(notebookId, rid, afterSeq?)` 封装 GET progress
- 1.2 类型来自 `@crystalith/shared` `ResearchProgressList`

### 2. Controller 状态

- 2.1 `useEdenLabController` 维护 `progressEvents[]` + `lastSeq`
- 2.2 加载 Run 时初始 pull；SSE `progress` 追加；终态后可 final gap-fill

### 3. UI 面板

- 3.1 Timeline/metrics 面板（非仅 log 文本）；展示 kind/headline/at/nodeId
- 3.2 Eden 模式禁用 `PHASE_PROGRESS` 假百分比作权威；fixture MAY 保留
- 3.3 `ResearchLabPage` 挂载 + testid

### 4. 测试

- 4.1 Vitest：mock progress 列表渲染；SSE 追加事件
- 4.2 awaiting_confirm 不与 playing 横幅矛盾（r437 回归）

### 5. 验证

- 5.1 `cd apps/web && bun run test:ci` + typecheck
- 5.2 `llman sdd validate c95-lab-progress-ledger-panel --strict --no-interactive`
