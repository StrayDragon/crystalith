## Why

当前 `StudioPanel.tsx` 中的复制功能未实现（TODO 注释），用户无法将生成的输出（FAQ/GUIDE/TIMELINE 等）复制或导出。这是基本的用户需求，影响产品实用性。

## What Changes

- 修复 StudioPanel 复制功能
- 添加导出为 Markdown 文件功能
- 添加复制成功的用户反馈

## Impact

- 受影响的规范：`workspace-ui`
- 受影响的代码：
  - `frontend/web/src/features/workspace/components/StudioPanel.tsx`
  - `frontend/web/src/features/workspace/components/StudioOutputViewer.tsx`
- 依赖关系：此变更为 T10（音频概述接口）和 T11（视频概述接口）提供基础
