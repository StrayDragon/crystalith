## Why
Studio 工具卡片在窄栏位下会被挤压，且左右边栏宽度固定，无法匹配参考图的可调交互与阅读舒适度。

## What Changes
- 增加左右边栏拖拽分割条，支持桌面端调整宽度并保持中间面板可用。
- 用 CSS 变量驱动三栏宽度，设定可调范围，避免布局过窄或过宽。
- Studio 工具卡片采用自适应网格，减少文字与徽章的挤压。

## Impact
- 受影响的规范：`workspace-ui`
- 受影响的代码：`frontend/web/src/features/workspace/components/WorkspaceLayout.tsx`、`frontend/web/src/features/workspace/WorkspacePage.css`、`frontend/web/src/features/workspace/components/StudioPanel.tsx`
