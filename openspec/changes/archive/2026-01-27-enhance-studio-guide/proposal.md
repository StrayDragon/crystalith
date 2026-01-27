## Why

当前指南输出是静态模块列表，用户无法在阅读过程中标记完成状态，也缺少可视化进度。现有输出结构已包含模块、目标与要点，可在前端以最小改动提供学习路径体验。

## What Changes

- **可勾选学习路径**：模块支持完成勾选并显示完成态
- **进度提示**：显示整体完成进度
- **模块折叠**：支持展开/折叠模块详情
- **轻量实现**：仅前端状态，不引入依赖关系、测验或持久化

## Impact

- 受影响的规范：`workspace-ui`, `refine-output`
- 受影响的代码：
  - `frontend/web/src/features/workspace/plugins/allPlugins.tsx`
  - `frontend/web/src/features/workspace/components/StudioOutputViewer.tsx`
  - 新增指南展示组件（前端）
