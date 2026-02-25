## Why

Research 会话的 SSE 连接生命周期需要严格依赖“当前会话状态”（planning/searching/analyzing/waiting_user 才允许保持/重连）。当前前端实现中，重连 gating 逻辑依赖 hook 闭包捕获的 `sessions` 状态，且调用侧对 hook 依赖做了抑制（eslint disable），在状态快速变化或长会话下可能出现：

- 会话已 completed/cancelled 但仍尝试重连（stale state）
- 会话仍活动但因为读到旧状态而停止重连

这会导致 SSE 连接不稳定、事件列表异常增长、以及用户看到错误的“连接失败/重连中”提示。

## What Changes

- 在 `useResearch` 中将 SSE 重连 gating 从“闭包捕获的 sessions”改为“始终读取最新状态”（例如 `useRef` 保存最新 sessions/activeSession，或在重连前调用 `fetchSession` 获取服务端真值）。
- 收敛 effect 依赖与清理：避免依赖抑制导致行为不一致；确保会话结束时立即关闭连接并取消定时器。
- 增加前端测试（或最小可行的集成测试）：模拟状态从活动→完成，断言不会再触发重连；并确保连接恢复/失败提示符合 `research-ui` spec。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `research-ui`: 强化 SSE 重连 gating 的一致性要求（必须基于最新会话状态），确保 completed/cancelled 后不再重连。

## Impact

- 受影响代码（预计）：
  - `frontend/web/src/features/workspace/domains/research/useResearch.ts`
  - `frontend/web/src/features/workspace/domains/sources/SourcesPanel.tsx`
  - 相关测试与可能的 SSE helper 抽取
