## Why

当前报告（简报）输出为静态分节列表，缺少章节导航与阅读体验。现有输出已包含分节与要点，可在前端提供目录与折叠能力。

## What Changes

- **章节目录**：基于分节标题生成目录并支持跳转
- **章节折叠**：支持折叠/展开分节内容
- **轻量实现**：不引入模板、图表、协作或版本历史

## Impact

- 受影响的规范：`workspace-ui`, `refine-output`
- 受影响的代码：
  - `frontend/web/src/features/workspace/plugins/allPlugins.tsx`
  - `frontend/web/src/features/workspace/components/StudioOutputViewer.tsx`
  - 新增报告展示组件（前端）
