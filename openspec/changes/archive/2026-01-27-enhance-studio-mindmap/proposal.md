## Why

当前思维导图已有可视化与基础交互（缩放、拖拽视图、节点折叠），但规范与任务仍围绕编辑/协作等高复杂功能。为保持变更与现状一致，先明确“只读交互式查看”的基线能力，并补齐必要的 UI 与测试。

## What Changes

- **只读交互视图**：支持缩放、平移与节点折叠/展开
- **全局控制**：提供展开全部/折叠全部操作
- **规范对齐**：将需求收敛为当前可实现的交互查看能力

## Impact

- 受影响的规范：`workspace-ui`, `refine-output`
- 受影响的代码：
  - `frontend/web/src/features/workspace/components/MindmapViewer.tsx`
  - `frontend/web/src/features/workspace/plugins/allPlugins.tsx`
