# research-ui (delta) Specification

## ADDED Requirements

### Requirement: SSE reconnection gating MUST use the latest session state
系统 MUST 以“最新的研究会话状态”为准决定是否继续重连（本地最新 state 或服务端真值），不得因为 stale closure/过期状态而在 completed/cancelled 后继续重连。

#### Scenario: Session completes before reconnect timer fires
- **WHEN** 会话状态从活动态变为 `completed`，且此前已安排了一个重连定时器
- **THEN** 定时器触发时系统不得创建新的 SSE 连接，并应清理连接相关资源
