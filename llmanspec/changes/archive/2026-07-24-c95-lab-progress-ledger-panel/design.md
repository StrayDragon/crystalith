# Design: c95 Lab progress ledger panel

> **状态**：Apply 锁定 · 全程 **main**
>
> **Locked 2026-07-24**：G1=A · G2=B · G3=B · **G4=A** · **G5=A** · G6=A+B+C

## 代理裁定

| ID  | 选择                                         | 理由                                                                   |
| --- | -------------------------------------------- | ---------------------------------------------------------------------- |
| G4  | **A** 加载最近 N（100）+ SSE + 终态 gap-fill | 与既有 `afterSeq` API 对齐；全量分页收益小；仅 SSE 则刷新 Run 时空面板 |
| G5  | **A** 点击 nodeId → `setSelectedNodeId`      | 控制器已有选中态；抽屉联动成本低、定位支路价值高                       |

## 数据源（Eden 权威）

```text
loadRun / create → GET …/progress?limit=100
SSE progress → merge by seq
terminal / stream end → gap-fill afterSeq=lastSeq
```

## UI（扩展顶栏 LabProgressBar）

| 区域     | 内容                                                                                       |
| -------- | ------------------------------------------------------------------------------------------ |
| 摘要条   | phase 标签 + **真实 %**（searches×0.55 + 支路完成×0.45）+ 最近 headline                    |
| 展开面板 | 指标：事件数、searchesUsed/maxSearches、researchDone/total；时间线 kind/headline/at/nodeId |
| nodeId   | 可点击聚焦图节点                                                                           |

## Eden vs fixture

- **两者**共用 `LabProgressBar` + ledger 形状
- **Eden**：HTTP/SSE；**禁止** `PHASE_PROGRESS`
- **Fixture**：相位推进合成 ledger；% 用 sourcesRetrieved 代理检索预算 + 节点完成比

## 非目标

- 不新增 runtime API
- 不改 M1 确认条（c96）
- per-node 预算（另 change）
