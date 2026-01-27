## Why

当前测验输出为静态题目列表，无法进行答题与反馈。现有结构已包含题目、选项、答案与解析字段，可在前端实现轻量测验体验。

## What Changes

- **交互式答题**：支持选择选项并提交
- **即时反馈**：显示对错与正确答案/解释
- **进度与结果**：显示当前题号与总题数，完成后显示正确率
- **轻量实现**：不引入计时、错题本或历史记录

## Impact

- 受影响的规范：`workspace-ui`, `refine-output`
- 受影响的代码：
  - `frontend/web/src/features/workspace/plugins/allPlugins.tsx`
  - `frontend/web/src/features/workspace/components/StudioOutputViewer.tsx`
  - 新增测验展示组件（前端）
