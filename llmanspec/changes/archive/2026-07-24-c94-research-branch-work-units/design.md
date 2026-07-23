# Design: c94 Research branch work-units

> **状态**：规划锁定 · Apply 全程 **main**
>
> **Locked 2026-07-24**：F1=A（有支路跳过 question 单元）· F2=B（`graph.nodes` 插入序稳定队列）· F3=A · F4=A
> **延后**：per-research-node 预算配额；全局 `maxSearches` 加高（另 change）。本变更主线 **先保证支路 work-unit 跑完**，不强化预算回退策略。

## 1. 调度顺序

```text
seed + decompose (c93)
  → if live research branches (F1=A): skip question work-unit
    else: question work-unit → writeBack
  → drainResearchWorkUnits
       for each pending research node (insertion-order FIFO):
         phase=retrieving graph_patch
         skip if pruned / budget exhausted (writeBack missing; continue)
         runNodeWorkUnit → writeBackNodeWork (phase=idle)
         progress unit_started / unit_finished
  → enterConfirm(budget) if pragmatic M1 still applies
  → synthesizeAndComplete (merge 边保留)
```

**FIFO 键**：`orderResearchNodesForWork(nodes)` — **仅 filter、保 `graph.nodes` 插入序**（decompose/fork 追加顺序）；禁止按 id/title 重排。
**延后**：per-node 预算配额；全局预算加高。

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
