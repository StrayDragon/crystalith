## Why

当前引用交互功能较为基础，用户无法快速预览引用内容或跳转到原文位置。增强引用交互可以提升用户验证和深入了解信息来源的效率。

## What Changes

- 实现引用悬停预览（Tooltip）
- 实现点击跳转到原文位置
- 实现多选引用对比功能

## Impact

- 受影响的规范：`citation-interaction`
- 受影响的代码：
  - `frontend/web/src/features/workspace/components/citations/`
  - `frontend/web/src/features/workspace/WorkspacePage.css`
- 依赖关系：依赖 T03（前端测试覆盖）和 T05（来源详情面板）
