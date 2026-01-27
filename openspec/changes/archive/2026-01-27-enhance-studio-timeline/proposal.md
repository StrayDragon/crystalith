## Why

当前时间轴输出为静态事件列表，难以直观看到事件的时间分布与顺序。现有输出已包含日期、事件与描述，可在前端实现轻量可视化展示。

## What Changes

- **可视化时间轴**：以纵向时间轴形式展示事件顺序
- **事件详情展开**：点击事件显示/隐藏描述
- **轻量实现**：不引入缩放、筛选或多轴对比

## Impact

- 受影响的规范：`workspace-ui`, `refine-output`
- 受影响的代码：
  - `frontend/web/src/features/workspace/plugins/allPlugins.tsx`
  - `frontend/web/src/features/workspace/components/StudioOutputViewer.tsx`
  - 新增时间轴展示组件（前端）
