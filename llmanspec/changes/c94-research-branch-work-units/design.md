# Design: c94 Research branch work-units

> **状态**：规划锁定 · Apply 在 `feat/c94-research-branch-work-units`

## 1. 调度顺序

```text
seed + decompose (c93)
  → [optional] question work-unit if still pending
  → drainResearchWorkUnits (extended)
       for each pending research node (FIFO by graph stable order):
         skip if pruned
         skip if budget exhausted (writeBack empty/partial)
         runNodeWorkUnit → writeBackNodeWork
         emit progress unit_started / unit_finished
  → enterConfirm(budget) if web budget semantics hit
  → synthesizeAndComplete (merge 边保留，报告汇聚)
```

**FIFO 键**：优先 `id` 字典序（或 seed 时赋予 `order`）；fork 新增节点追加在队列末尾（与 r318 串行语义一致）。

## 2. `drainResearchWorkUnits` 交互

现有函数已过滤 `role=research` + 非 pruned + 缺 evidence。本变更：

| 项          | 行为                                                                              |
| ----------- | --------------------------------------------------------------------------------- |
| 触发点      | question 写回后 **以及** resume confirm 后 MUST 再次 drain                        |
| phase       | 单元开始前设 `phase=retrieving`（graph_patch）；结束后 `phase=idle` via writeBack |
| pruned 竞态 | 每单元前 `requireFresh` + discard-if-pruned（已有）                               |
| abort       | cancel / prune 活动节点仍 AbortSignal 中止（r318）                                |

不新增并行 worker；保持单线程串行 CP1。

## 3. Evidence writeback

- 每节点独立 `evidenceIds`；`writeBackNodeWork` 设置 `conclusionStatus`：`partial`（有证据）/ `missing`（无）
- **不**删除 merge 边；结论 synthesize MUST 可读各支路 summary/evidence
- 预算耗尽：记 log + `unit_skipped` 或写回 missing，继续下一节点

## 4. M1 / synthesize

- 分支波次完成后，若 `searchesUsed > 0 && searchesUsed < maxSearches` 且 allowWeb → `enterConfirm('budget')`（保持现 pragmatic M1）
- `synthesizeAndComplete` 不变；MUST NOT 为省事先删 merge 边

## 5. Progress 事件

| 时机           | kind                                        |
| -------------- | ------------------------------------------- |
| 开始某节点单元 | `unit_started` + nodeId                     |
| 写回完成       | `unit_finished`                             |
| pruned 跳过    | `unit_skipped_pruned`                       |
| 预算跳过       | `unit_finished` 或 `budget_tick` + headline |

## 6. 测试要点

- 3 research 节点均获得 evidence 写回
- 中间 prune 一支，其余继续
- completed 图仍含全部 merge→conclusion
