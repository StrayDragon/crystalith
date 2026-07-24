---
depends_on: [c93-research-topic-decompose-kernel]
---

## Why

c93 将建立多 research 支路，但当前 `runLoop` 在 question work-unit 后仅 opportunistically 调用 `drainResearchWorkUnits`（主要为 fork 子节点）。需将 **所有活 research 节点**纳入串行 work-unit 调度，写回证据并 emit phase/graph_patch，再进入既有 M1 budget confirm 与 synthesize 收束。

## What Changes

1. **扩展调度**：`runLoop` MUST 在拆解后对全部非 pruned `role=research` 节点串行执行 work-unit（不仅 question）。
2. **Phase 更新**：每单元开始/结束 MUST 更新节点 `phase` 并经 `graph_patch` 推送；写回 `writeBackNodeWork`。
3. **Merge 不变**：收束前 MUST 保留各 research→conclusion 的 merge 边（含 partial/missing 汇入语义）。
4. **M1 门**：完成分支波次后仍走既有 `enterConfirm`（budget）与 `synthesizeAndComplete`；不恢复逐步审批。
5. **Progress**：每单元 `unit_started` / `unit_finished` / `unit_skipped_pruned` 入账本。
6. **测试**：多节点 Run 集成测；pruned 节点跳过；预算耗尽跳过。

## Capabilities

- `deep-research-runtime` — r327 分支 work-unit 调度

## Impact

- depends_on `c93-research-topic-decompose-kernel`
- **BDD-off**；design.md 锁定调度顺序与 `drainResearchWorkUnits` 关系
- **Apply**：**全程 main**
- **Fixture xlsx-lib** 保留至 c100；Eden 默认
- **M1 confirms 保留**（budget / expand_branch）
- **进度**来自真实 ledger，非 timer
- **MUST NOT defer further**：多支路研究无此变更无法端到端可用

## Seams

- `apps/server/src/features/research/service.ts` — `runLoop`、`drainResearchWorkUnits`、`writeBackNodeWork`、`enterConfirm`
- `runNodeWorkUnit` — 检索/证据收集
- `emitGraphPatch` / `appendProgressEvent`
- 不含：Lab progress 面板（c95）
