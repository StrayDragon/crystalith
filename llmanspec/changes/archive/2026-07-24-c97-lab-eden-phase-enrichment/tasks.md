# Tasks: c97-lab-eden-phase-enrichment

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r450 + scenarios
- [x] validate change (strict, no-interactive)

## Apply（`llman-sdd-apply` · 全程 main）

### Locked（2026-07-24）

- I1=A：status → progress →（I5 覆盖第三档）
- I2=A：running 时顶栏细相位
- I3=B：Fixture 共用 derive + 假 ledger
- I4=A：graph_patched_summary → decompose
- I5=B：无 progress 固定 explore/decompose，不猜节点众数

### 1. Eden 相位推导

- [x] 1.1 `deriveEdenLabPhase` 聚合 status + progressEvents
- [x] 1.2 evaluate/integrate 映射；awaiting/playing 对齐 r437
- [x] 1.3 Vitest 事件序列 → labPhase

### 2. Controller 接线

- [x] 2.1 `useEdenLabController` 用 derive；无 timer
- [x] 2.2 Fixture `displayPhase` 共用 derive（I3=B）

### 3. UI 消费

- [x] 3.1 LabProgressBar / ledger 经 lab.phase 同源
- [x] 3.2 Vitest：顶栏推导单测覆盖

### 4. 验证

- [x] 4.1 ran web Vitest CI and typecheck
- [x] 4.2 ran llman sdd validate for this change
