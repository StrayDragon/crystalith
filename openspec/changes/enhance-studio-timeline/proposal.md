## Why

当前时间轴功能仅生成静态事件列表，缺乏可视化时间线和交互能力。用户无法直观地看到事件的时间跨度、相对位置，也无法进行缩放和筛选。

## What Changes

- **可视化时间轴**：使用水平/垂直时间轴组件，直观展示事件分布
- **时间缩放**：支持缩放查看不同时间粒度（年/月/日）
- **事件分类**：按类型（技术/政治/文化等）对事件着色分组
- **事件详情弹窗**：点击事件显示详细信息和引用来源
- **时间范围筛选**：支持拖拽选择时间范围进行筛选
- **里程碑标记**：突出显示关键里程碑事件
- **对比视图**：支持多条时间轴并排对比

## Impact

- 受影响的规范：`workspace-ui`, `refine-output`
- 受影响的代码：
  - `frontend/web/src/features/workspace/plugins/allPlugins.tsx`
  - `frontend/web/src/features/workspace/components/StudioOutputViewer.tsx`
  - `backend/py/src/crystalith/outputs/generators/timeline.py`
