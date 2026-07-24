# Design: c96 M1 confirm surface

> **状态**：薄设计 · Apply 在 `feat/c96-lab-m1-confirm-surface`

## confirmKind 文案

| confirmKind     | 标题语义           | 主/次动作                                                |
| --------------- | ------------------ | -------------------------------------------------------- |
| `budget`        | 预算将尽，是否继续 | `continue`（继续深挖）/ `finish_report`（生成结论）      |
| `expand_branch` | 提议扩展支路       | `approve_branch` / `skip_branch`；`finish_report` 仍可用 |

## 高亮

```
awaiting_confirm && confirmBranchNodeId
  → highlightedNodeIds = [confirmBranchNodeId]（及可选邻接节点）
  → LabGraph 已有 highlighted 样式
```

## API 映射

| UI       | `POST …/confirm` body                        |
| -------- | -------------------------------------------- |
| 继续深挖 | `{ action: 'continue' }`                     |
| 生成结论 | `{ action: 'finish_report' }`                |
| 批准扩支 | `{ action: 'approve_branch', branchNodeId }` |
| 跳过支路 | `{ action: 'skip_branch', branchNodeId }`    |

## 错误（r410）

`RESEARCH_BUDGET` / `RESEARCH_INVALID_STATE` → 确认条内联或 toast；复用既有 `AppHttpError` 路径。

## 非目标

- 不恢复逐步计划审批 UI
- 不改服务端 confirm 合约
