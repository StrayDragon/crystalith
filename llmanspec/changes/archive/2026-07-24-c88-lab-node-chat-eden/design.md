# Design: c88 Lab node chat Eden

## Scope

将 **节点抽屉 chat** 从 fixture `proposeNodeChatTurn` 切到 c78 **chat SSE 命令口**。无新后端合约（复用 c78）；前端新增 Eden stream 客户端与 mode 分支。

## Chat 流

```
用户输入 → LabNodeDrawer.send（eden）
    → streamNodeChat(notebookId, rid, nodeId, { message })
        → POST …/nodes/:nodeId/chat (SSE)
    ← chunk（增量正文）
    ← proposal（ActionProposal 列表）
    ← done | error
    → UI 追加 assistant 消息 + proposals
用户 accept 提案
    → acceptNodeChatAction（已有）
        → prune / fork / patch / confirm / openReport（c85）
    → MUST NOT 仅本地改图
```

Chat SSE **独立于** Run `GET …/stream`（r322 / c78 §7.3）。

## Mode 分支

| `mode`    | send 行为                           | accept 行为                                 |
| --------- | ----------------------------------- | ------------------------------------------- |
| `eden`    | HTTP chat SSE                       | Eden controller 命令口                      |
| `fixture` | `proposeNodeChatTurn` + 本地 stream | 既有 `acceptNodeChatAction` + lab mutations |

gated by `VITE_LAB_FIXTURE=1` 或 `LabWorkbench.mode === 'fixture'`。

## 提案 → 命令口映射

| Proposal kind                         | Eden 命令             |
| ------------------------------------- | --------------------- |
| `prune_node`                          | `POST …/prune`        |
| `fork_sibling`                        | `POST …/fork`         |
| `rewrite_query`                       | `PATCH …/nodes/:id`   |
| `set_conclusion_status`               | `PATCH …/nodes/:id`   |
| `confirm_finish` / `confirm_continue` | `POST …/confirm`      |
| `open_report`                         | `openReport()`（c85） |

与 r417 一致；Structure 类 MUST 经用户确认。

## Busy / 互斥

- 发送前：若 `run.llmActivity` 非 null 或本地 `streaming` → 禁用输入
- `error` 事件 → 行内错误 + `lastError`
- cancel Run（c86）MUST 中止进行中的 chat（服务端已有；客户端 stop stream on unmount）

## Seams

| 模块                             | 职责                               |
| -------------------------------- | ---------------------------------- |
| `edenResearchApi.streamNodeChat` | SSE 解析 chunk/proposal/done/error |
| `LabNodeDrawer`                  | mode prop；eden send 路径          |
| `ResearchLabPage`                | 传 mode；`onAcceptAction` 已有     |
| `useEdenLabController`           | 暴露 `runId`、`llmActivity`、busy  |
| `proposeNodeChatTurn`            | fixture-only                       |

## 与邻接 change 边界

- **c85**：`open_report` 提案导航；c88 可依赖 c85 或临时 no-op 至 c85 合并
- **c86**：cancel 中止 chat
- **c87**：evidence 列表与 chat 独立

## Guardrails

- MUST NOT 在 Eden 默认路径调用 `proposeNodeChatTurn`
- MUST NOT 在 chat accept 中静默改图（r417、r320）
- MUST NOT 将 chat 事件混入 Run stream 处理器

## Testing

- Vitest：eden send 调用 stream API；fixture 仍走 propose
- Vitest：accept prune → mock `pruneResearchNode`
- 手测：对话 → 收到 proposal → accept → 图更新
