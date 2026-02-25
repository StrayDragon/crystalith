## Context

- `useResearch` 负责创建/维护研究会话 SSE 连接、重连与 stale 检测，并在事件到达时更新 `activeSession` 与 `sessions`。
- 当前重连 gating 依赖闭包捕获的 `sessions`，而调用侧对 hook 依赖有抑制，导致当会话状态从活动 → completed/cancelled 后，延迟触发的重连可能仍读取到旧状态并继续重连（或相反）。

## Goals / Non-Goals

**Goals:**
- 重连 gating 必须基于“最新会话状态”（本地最新 state 或服务端真值），避免 stale closure。
- completed/cancelled 时立即释放 SSE 连接，并且任何已排队的重连/interval 不得再创建新的 EventSource。
- 增加可重复的前端测试覆盖（使用 fake timers + mock EventSource）。

**Non-Goals:**
- 不改变 SSE 事件的协议与 UI 展示语义（仅修复连接生命周期与稳定性）。

## Decisions

### 1) 用 ref 持有“最新状态”供定时器/回调读取
**Decision:** 在 hook 内维护 `sessionsRef`/`activeSessionRef`，在 state 更新时同步更新 ref；所有 `setTimeout`/事件回调在需要判断是否重连时从 ref 读取，而不是依赖闭包捕获值。

**Rationale:** 定时器回调天然跨渲染，闭包值容易过期；ref 是 React 中处理此类一致性问题的常用模式。

### 2) 重连前可选拉取服务端真值（以状态为准）
**Decision:** 在触发重连前（或在首次失败后）调用 `fetchSession(researchId)` 获取最新 status；只有当 status 仍为活动态（planning/searching/analyzing/waiting_user）才允许重连。

**Rationale:** 本地 state 可能因网络中断而滞后；以服务端真值作为最终 gating 更稳健。

### 3) 收敛 effect 依赖与清理，避免 eslint 依赖抑制
**Decision:** 调整 `SourcesPanel`/调用侧 effect 依赖，避免通过禁用 exhaustive-deps 获得“偶然正确”的行为；确保订阅与清理严格由 `activeSession.id/status` 驱动。

**Rationale:** 依赖抑制会掩盖 stale callback 风险，也不利于未来演进。

## Risks / Trade-offs

- **[风险]** 重连前额外 `fetchSession` 增加请求量 → **缓解**：仅在断线/需要重连时调用，且遵循指数退避与最大次数上限。
- **[风险]** mock EventSource 测试维护成本 → **缓解**：只覆盖关键路径（completed 后不重连、活动态允许重连、清理关闭连接），其余通过手动验证补充。

## Migration Plan

- 前端单独发布；无后端迁移。
- 合并后运行 `pnpm test` + 手动验证 SSE 生命周期。

## Open Questions

- 是否需要在 SSE 端点层提供一个明确的“terminal”事件（done/cancelled）以便客户端无需额外 fetch 即可停止重连？
