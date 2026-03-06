# workspace-shared-ui-state Specification

## Purpose

定义 Crystalith session 级别的 server-authoritative `shared_state` 合同，特别是 `shared_state.ui` 如何通过 Rivu snapshot/delta 驱动前端 mounts、交互事件与刷新恢复。

## Non-goals

- 不定义具体图表/表格组件的视觉样式
- 不定义浏览器本地瞬时状态（如 hover、滚动位置）的持久化策略
- 不要求在 `message.content` 中嵌入任何 UI 元数据

## Requirements

### Requirement: Session shared_state is persisted and revisioned
每个 session MUST 持久化 `shared_state` 与 `shared_state_revision`。`shared_state` MUST 至少包含 `ui` 根对象，且每次成功应用 UI delta 后 MUST 递增 revision。

#### Scenario: New session starts with empty ui state
- **WHEN** 系统创建一个新的 session
- **THEN** `shared_state.ui` SHALL 初始化为合法的空 Rivu UI state
- **AND** `shared_state_revision` SHALL 初始化为 `0`

### Requirement: QA responses expose shared_state out-of-band
QA 非流式响应 MUST 返回 `answer`、稳定的 `message_id`、`shared_state` 与 `shared_state_revision`；assistant `content` 本身 MUST 保持纯文本。

#### Scenario: Non-stream stats returns mounts in shared_state.ui
- **WHEN** stats preset 生成了可校验的结构化结果
- **THEN** 响应 SHALL 将 `fallback_markdown` 作为 `answer`
- **AND** SHALL 通过 `shared_state.ui` 返回图表/表格 mounts
- **AND** SHALL 返回与持久化 message 对齐的稳定 `message_id`

### Requirement: QA stream publishes snapshot then deltas
QA 流式响应 MUST 在开始时发送一次 `state_snapshot`，并在需要时发送后续 `state_delta` 事件；这些事件 MUST 与同一条 assistant message 的稳定 `message_id` 对齐。

#### Scenario: Stream starts with a stable assistant message id
- **WHEN** 客户端发起 `/qa/stream`
- **THEN** 服务端 SHALL 先发送包含 `message_id`、`shared_state`、`shared_state_revision` 的 `state_snapshot`
- **AND** 后续 `state_delta` SHALL 仅表达 shared state 的增量变化

### Requirement: UI event handling is validated idempotent and revision-aware
系统 MUST 提供 session-scoped `ui.v1.event` 入口，并使用 `clientRequestId` 做幂等、使用 `baseRevision` 做并发控制。

#### Scenario: Duplicate client request is idempotent
- **WHEN** 客户端重复发送相同的 `clientRequestId`
- **THEN** 服务端 SHALL 返回与首次处理一致的 delta 与 `shared_state_revision`

#### Scenario: Stale base revision is rejected
- **WHEN** 客户端发送的 `baseRevision` 落后于当前 session revision
- **THEN** 服务端 SHALL 返回并发冲突错误

### Requirement: Refresh restores mounts from server state
前端刷新后 MUST 能通过重新获取 session `shared_state.ui` 恢复已持久化的 mounts，而不依赖之前的 SSE 内存态。

#### Scenario: Page reload reconstructs mounts
- **WHEN** 用户刷新页面并重新打开同一个 session
- **THEN** 前端 SHALL 请求 `/ui/state`
- **AND** SHALL 用返回的 snapshot 重建该 session 的 Rivu kernel state 与消息下方 mounts
