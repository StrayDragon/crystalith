## Why

`WorkspaceLayout.tsx` 目前承载了大量跨域状态（dialog/viewer/slides/graph 等）、副作用（订阅、请求、事件处理）与布局拼装逻辑，文件体量接近千行，带来：

- 修改风险高：小改动容易触发意外副作用
- 复用困难：对话框/面板逻辑难以独立测试或迁移
- 代码审阅成本高：很难定位某个功能的“唯一入口”

需要按领域与职责拆分 WorkspaceLayout，将状态与副作用收敛到更小、更可组合的组件/contexts/hooks 中，提升可维护性与演进速度。

## What Changes

- 将 `WorkspaceLayout` 拆分为若干聚焦模块（例如 Header、Canvas/Panels、Dialogs/Overlays、Keyboard/Commands），并明确 props/contexts 边界。
- 将跨域 UI 状态迁移到 workspace store slice（或专用 context），避免在单组件内堆叠大量 `useState`。
- 对拆分后的关键路径做回归验证（至少：Sources/Chat/Studio 基本交互不回归；常用 dialogs 正常；布局/锁定逻辑不变）。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `frontend-module-structure`: 强化 workspace 顶层容器组件的边界与拆分策略，避免单文件聚合跨域副作用与状态。

## Impact

- 受影响代码（预计）：
  - `frontend/web/src/features/workspace/layout/WorkspaceLayout.tsx`
  - 新增 `frontend/web/src/features/workspace/layout/components/*` 或 `layout/*` 子模块
  - workspace store slices / shared hooks
- 风险：
  - UI 行为回归 → 通过渐进拆分（先提取纯组件，再迁移状态）与手动回归清单降低风险
