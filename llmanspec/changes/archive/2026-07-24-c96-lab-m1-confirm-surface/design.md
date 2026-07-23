# Design: c96 M1 confirm surface

> **状态**：Apply 锁定 · 全程 **main**
>
> **Locked 2026-07-24**：H1=A · H2=B · H3=A · H4=B · H5=A

## confirmKind 文案与顶栏动作（H1=A · H3=A）

| confirmKind     | 横幅/提示语义          | 顶栏按钮                                                                                                        |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| `budget`        | 预算将尽，是否继续深挖 | secondary=`continue`「继续深挖」· primary=`finish_report`「生成结论」                                           |
| `expand_branch` | 提议扩展支路           | secondary=`skip_branch`「跳过支路」· primary=`approve_branch`「批准扩支」· tertiary=`finish_report`「生成结论」 |

`budget` **不**展示 approve/skip。

## 高亮（H2=B）

```
awaiting_confirm && confirmBranchNodeId
  → highlightedNodeIds = [branchId] ∪ 直接邻接（出入边一端）
```

## API 映射

| UI       | `POST …/confirm` body                        |
| -------- | -------------------------------------------- |
| 继续深挖 | `{ action: 'continue' }`                     |
| 生成结论 | `{ action: 'finish_report' }`                |
| 批准扩支 | `{ action: 'approve_branch', branchNodeId }` |
| 跳过支路 | `{ action: 'skip_branch', branchNodeId }`    |

## 错误（H4=B）

`RESEARCH_BUDGET` / `RESEARCH_INVALID_STATE` → **确认条区域上方内联**（复用 `lastError` 红条）；confirm 路径 **不** toast。

## Fixture（H5=A）

进入 `awaiting_confirm` 时：有活 research 节点 → `expand_branch` + 高亮该节点邻接；否则 `budget`。skip/approve 本地推进回放。

## 非目标

- 不恢复逐步计划审批 UI
- 不改服务端 confirm 合约
