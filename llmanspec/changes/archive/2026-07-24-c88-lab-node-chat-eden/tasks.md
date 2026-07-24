# Tasks: c88-lab-node-chat-eden

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r438–r440 + scenarios
- [x] `llman sdd validate c88-lab-node-chat-eden --strict --no-interactive --stage spec`

## Apply（`llman-sdd-apply`）

### 1. Eden chat SSE 客户端

- [x] 1.1 `edenResearchApi.streamNodeChat`：`POST …/nodes/:nodeId/chat` SSE 解析 chunk/proposal/done/error
- [x] 1.2 类型对齐 `@crystalith/shared` chat body 与事件形

### 2. LabNodeDrawer 接线

- [x] 2.1 `LabNodeDrawer` 接受 `mode` + `onSendChat`（eden）或内部分支
- [x] 2.2 Eden send：流式更新 assistant 消息与 proposals；移除默认 `proposeNodeChatTurn`
- [x] 2.3 `llmActivity` / `streaming` 时禁用重复发送；错误可见

### 3. 提案 accept（对齐 r417）

- [x] 3.1 确认 `acceptNodeChatAction` 各 kind 走 Eden controller（prune/fork/patch/confirm/open_report）
- [x] 3.2 fixture 路径保留 `proposeNodeChatTurn` + 本地 accept

### 4. 验证

- [x] 4.1 Vitest：eden vs fixture send 分支；accept → mock 命令口
- [x] 4.2 `cd apps/web && bun run test:ci` + server research chat 子集
- [x] 4.3 `llman sdd validate c88-lab-node-chat-eden --strict --no-interactive`
- [x] 4.4 手测：对话 → 提案 → accept → HTTP 改图
  - 覆盖：Vitest（stream + accept → prune/patch ports）；服务端 `node chat streams proposals` 回归已绿。完整浏览器手测留给本地 Lab。
