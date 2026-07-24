# Tasks: c97-lab-eden-phase-enrichment

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r450 + scenarios
- [x] `llman sdd validate c97-lab-eden-phase-enrichment --strict --no-interactive`

## Apply（`llman-sdd-apply` · 全程 main）

### 1. Eden 相位推导

- 1.1 实现 `deriveEdenLabPhase`（或等价）：聚合 run.status、progress 事件、nodes[].phase
- 1.2 映射表：至少 evaluate / integrate 与 fixture 可比；`awaiting_confirm` / `playing` 对齐 r437
- 1.3 Vitest：progress 事件序列 → 期望 labPhase

### 2. Controller 接线

- 2.1 `useEdenLabController`：合并 SSE progress + GET progress；Eden 路径不调用 timer playback
- 2.2 `researchGraphAdapter`：节点 phase 字段参与展示（若尚未）

### 3. UI 消费

- 3.1 `LabProgressBar` + c95 ledger 面板共用推导结果
- 3.2 Vitest：顶栏与 ledger 同一输入下标签一致

### 4. 验证

- 4.1 `cd apps/web && bun run test:ci` + `bun typecheck`
- 4.2 `llman sdd validate c97-lab-eden-phase-enrichment --strict --no-interactive`
