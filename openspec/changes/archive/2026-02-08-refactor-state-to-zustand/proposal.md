## Why

当前前端工作区使用 React Context + useReducer 进行状态管理。随着功能增长（notebook、session、source、message、output、research、analysis 等领域），单一 WorkspaceContext 变得庞大，且 Context 的任何状态变化都会触发所有消费者组件的重渲染。项目已引入 Zustand 依赖但未在主工作区使用。迁移到 Zustand 可实现细粒度订阅、减少不必要的重渲染、简化状态逻辑。

## What Changes

- 将 WorkspaceContext + workspaceReducer 迁移为 Zustand store
- 按领域拆分为独立的 store slice（notebooks, sessions, sources, messages, outputs, research 等）
- 保留现有 hook 接口（useNotebooks, useSessions 等），内部实现改为 Zustand selector
- 移除 WorkspaceContext 和 WorkspaceProvider

## Impact

- 受影响的规范：`frontend-module-structure`（MODIFIED）
- 受影响的系统：
  - 前端状态管理层
  - 所有 domain hook
  - WorkspaceLayout 和各面板组件
