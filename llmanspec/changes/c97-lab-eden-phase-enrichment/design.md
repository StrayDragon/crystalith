# Design: c97-lab-eden-phase-enrichment

## 相位推导（Eden）

```text
inputs:
  run.status (queued|running|awaiting_confirm|completed|…)
  SSE progress events (node_phase, work_unit, …)
  GET …/progress snapshot（若有）
  graph nodes[].phase（research 节点）

output:
  labPhase: idle|explore|evaluate|integrate|awaiting_confirm|completed|…
  playing: boolean（仅 queued/running 且非 awaiting_confirm — 对齐 r437）
```

## 映射原则

| 信号                              | 规则                                                                     |
| --------------------------------- | ------------------------------------------------------------------------ |
| `status=awaiting_confirm`         | `labPhase=awaiting_confirm`，`playing=false`                             |
| `status` 终态                     | `labPhase=completed`（或 failed/cancelled 等价）                         |
| progress `node_phase` / work_unit | 映射到 evaluate / integrate 当内核上报对应 phase                         |
| 图启发式                          | 当无 progress 事件时，按活跃 research 节点 `phase` 众数回退              |
| fixture timer                     | **仅** `mode=fixture`；Eden MUST NOT 调用 `advanceLabPlayback` 更新 SSOT |

## 与 c95 ledger

Ledger 行与顶栏 **共用** `deriveEdenLabPhase(run, progress, nodes)` 单一函数，避免双份映射表。

## 非目标

- 不新增服务端 phase 枚举
- 不改变 work-unit 内核语义（c94）
