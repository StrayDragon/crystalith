## Why

当前 `SourceDetailDialog.tsx` 功能较为简单，用户无法查看来源的摘要、关键词、统计信息等详细内容，也无法在单个来源上下文中提问。增强来源详情面板可以提升用户对来源的理解和利用效率。

## What Changes

- 增强 `SourceDetailDialog.tsx` 功能
- 调用 `/sources/{id}/summary` API 显示来源摘要
- 显示关键词标签和统计信息（字数/页数）
- 支持在来源内提问功能

## Impact

- 受影响的规范：`workspace-ui`
- 受影响的代码：
  - `frontend/web/src/features/workspace/components/SourceDetailDialog.tsx`
  - `frontend/web/src/features/workspace/hooks/useSources.ts`
- 依赖关系：此变更为 T06（引用交互增强）提供展示基础
