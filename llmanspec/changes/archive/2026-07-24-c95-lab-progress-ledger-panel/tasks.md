# Tasks: c95-lab-progress-ledger-panel

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r448 + scenarios
- [x] validate change (strict, no-interactive)

## Apply（`llman-sdd-apply` · 全程 main）

### Locked（2026-07-24）

- G1=A：扩展顶栏 ProgressBar + 可展开时间线
- G2=B：真实 % = searches + 支路完成比
- G3=B：Fixture 假 ledger，与 Eden UI 同构
- G4=A：最近 100 + SSE + 终态 gap-fill
- G5=A：nodeId 点击选中图节点
- G6=A+B+C：事件数 + 检索预算 + 支路完成

### 1. API client

- [x] 1.1 `edenResearchApi.listProgress` 封装 GET progress
- [x] 1.2 类型来自 `@crystalith/shared` `ResearchProgressList`

### 2. Controller 状态

- [x] 2.1 `useEdenLabController` 维护 `progressEvents` + seq merge
- [x] 2.2 加载/创建 pull；SSE 追加；终态 gap-fill
- [x] 2.3 Fixture `useLabController` 合成 ledger + 同构 metrics

### 3. UI 面板

- [x] 3.1 `LabProgressBar` timeline/metrics（非仅 log）
- [x] 3.2 禁用 PHASE_PROGRESS 权威 %；fixture 用假预算
- [x] 3.3 testid `research-lab-progress` + `research-lab-progress-ledger`

### 4. 测试

- [x] 4.1 Vitest：ledger helpers + ProgressBar 渲染/点击
- [x] 4.2 ran web Vitest CI and typecheck
- [x] 4.3 ran llman sdd validate for this change
