---
depends_on: [c82-wire-lab-eden, c78-deep-research-kernel]
---

## Why

c78 已定义节点 chat 命令口（`POST …/nodes/:nodeId/chat` SSE）；c82 作业台 prune/fork/PATCH/confirm 已部分接线，但节点抽屉对话仍走 fixture `proposeNodeChatTurn` 与本地 mock accept。Eden 路径需要把用户对话与提案落到真实 HTTP/SSE，并对齐 r417「提案须经命令口执行」。

## What Changes

1. **Chat 接线**：Eden 模式下节点抽屉发送 → `POST …/research/:rid/nodes/:nodeId/chat`；流式 chunk/proposal/done 进抽屉消息列表。
2. **提案执行**：accept 映射 `prune_node` / `fork_sibling` / `rewrite_query`（PATCH）/ `confirm_*` / `open_report`，与 `ResearchLabPage.acceptNodeChatAction` 及 Eden controller 对齐。
3. **Fixture 隔离**：仅 `VITE_LAB_FIXTURE=1`（或 fixture mode）保留 `proposeNodeChatTurn`；Eden 默认 MUST NOT mock 为权威。
4. **互斥与 busy**：Run `llmActivity` 为 `node_chat` 或 work_unit 进行时 MUST 禁用重复发送；chat 失败可见（`lastError` 或行内错误）。
5. **质量**：server chat 回归（已有 c78）+ Lab Vitest；手测一轮对话 → 提案 → accept → 图变更经 HTTP。

## Capabilities

- `deep-research-ui` — 节点 chat Eden 接线

## Impact

- depends_on c82 + c78 内核合约
- 不含 revisions/convert（c89）；`open_report` 导航依赖 c85（可并行，提案可先 toast 直至 c85 落地）
- 浏览器已证：`LabNodeDrawer.send` 固定调用 `proposeNodeChatTurn`

## Seams

- `LabNodeDrawer` chat tab + `send` 分支（mode）
- `edenResearchApi.streamNodeChat`（新）或 `streamRequest` 封装
- `useEdenLabController` / `ResearchLabPage.acceptNodeChatAction`
- `fake/proposeNodeChatTurn` 降级边界
- Shared `ResearchNodeChatBodySchema` / SSE event shapes
