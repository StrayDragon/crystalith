# frontend-module-structure (delta) Specification

## ADDED Requirements

### Requirement: WorkspaceLayout MUST delegate overlays and side-effects to focused modules
Workspace 顶层布局组件（例如 `WorkspaceLayout`）MUST 将 overlays/dialogs 的状态与副作用收敛到聚焦的 hooks/模块中，并将 overlays 的展示部分拆分为纯渲染组件，避免单文件聚合跨域 state 与副作用。

#### Scenario: Overlay close policy is centralized
- **WHEN** 用户触发关闭 overlay（例如 Escape）
- **THEN** 系统通过单一的 `closeActiveOverlay` 策略决定关闭顺序，并确保相关资源被清理（timeouts/EventSource/临时 state）
