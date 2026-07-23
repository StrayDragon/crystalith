# Tasks: c87-lab-node-evidence-status-sync

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r434–r437 + scenarios
- [x] `llman sdd validate c87-lab-node-evidence-status-sync --strict --no-interactive --stage spec`

## Apply（`llman-sdd-apply`）

### 1. Evidence 映射与抽屉

- [x] 1.1 实现 `evidenceToLabCitation`（或扩展现有 adapter）：`ResearchEvidence` / report citations → `LabCitation`
- [x] 1.2 `useEdenLabController` 暴露 Eden citations map（来自 run evidences 或联表）
- [x] 1.3 `ResearchLabPage`（eden）：`LabNodeDrawer` 传 Eden citations，非 `lab.scenario.citations`
- [x] 1.4 若 GET run 缺 `evidences[]`：最小补 shared schema + serializeRun（与 UI 同步落地）

### 2. 节点终态展示

- [x] 2.1 `researchGraphAdapter` / `labLayout`：completed Run 结论节点非「排队…」
- [x] 2.2 图节点 status 标签反映 `conclusionStatus` 与 Run 终态

### 3. SSE / reload 对齐

- [x] 3.1 `status` → completed/failed/cancelled 时 `getResearchRun` 全量刷新
- [x] 3.2 `graph_patch` 后节点 `evidenceIds` / phase 与 GET 一致

### 4. 进度与 playing

- [x] 4.1 `awaiting_confirm`：不展示 playing 探索横幅；展示等待确认文案
- [x] 4.2 修正 `ResearchLabPage` 暂停横幅条件，避免与 `LabProgressBar` phase 矛盾

### 5. 验证

- [x] 5.1 Vitest：evidence 映射；终态标签；awaiting_confirm 横幅
- [x] 5.2 `cd apps/web && bun run test:ci`（相关子集）+ `bun typecheck`
- [x] 5.3 `llman sdd validate c87-lab-node-evidence-status-sync --strict --no-interactive`
- [x] 5.4 手测：completed + evidence → 抽屉引用非空
