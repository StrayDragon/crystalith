# Design: c95 Lab progress ledger panel

> **状态**：薄设计 · Apply 在 `feat/c95-lab-progress-ledger-panel`

## 数据源（Eden 权威）

```text
loadRun → GET …/progress?limit=N
SSE progress → append by seq (dedupe)
terminal status → optional gap-fill afterSeq=lastSeq
```

## UI

| 区域     | 内容                                                                  |
| -------- | --------------------------------------------------------------------- |
| 摘要条   | 最近 headline + 事件计数（可保留 `researchLabProgress` testid）       |
| 展开面板 | 时间线：at、kind、headline、nodeId                                    |
| 指标     | 从 ledger payload 或 run 字段派生（tokens/来源/待处理 — 优先 ledger） |

## Eden vs fixture

- **Eden**：禁用 `PHASE_PROGRESS[phase]` 作权威百分比
- **Fixture**：MAY 保留 phase 映射演示

## 非目标

- 不新增 runtime API（复用 r311 progress + GET progress）
- 不改 M1 确认条（c96）
