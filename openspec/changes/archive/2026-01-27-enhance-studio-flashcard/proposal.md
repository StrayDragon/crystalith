## Why

当前闪卡输出是静态问答列表，学习时需要手动在问题/答案之间切换，缺少基本的自测交互。现有数据结构已包含 question/answer，因此可以在前端以最小改动提供翻转与学习导航体验。

## What Changes

- **翻转式卡片浏览**：点击或按空格键翻转卡片，正面显示问题、背面显示答案
- **学习导航与进度**：上一张/下一张切换，并显示当前进度
- **轻量交互**：仅前端状态，不引入 SRS、持久化或导出

## Impact

- 受影响的规范：`workspace-ui`, `refine-output`
- 受影响的代码：
  - `frontend/web/src/features/workspace/plugins/allPlugins.tsx`
  - `frontend/web/src/features/workspace/components/StudioOutputViewer.tsx`
  - 新增闪卡展示组件（前端）
