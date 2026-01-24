## Why

当前搜索体验存在两个问题：
1. 用户从搜索结果添加网页或来源后，搜索栏会关闭，需要重新打开才能继续添加
2. 搜索必须等待当前搜索完成才能发起下一个搜索，无法队列化多个搜索请求

这些限制降低了用户批量添加来源的效率。

## What Changes

- 添加来源后保持搜索结果队列可见，不自动清空或关闭
- 搜索点击后立即生成 loading 状态的结果胶囊，允许用户继续发起新搜索
- 多个搜索请求队列化处理，每个搜索生成独立的结果胶囊组
- 搜索按钮在搜索进行中不禁用，允许连续发起多个搜索

## Impact

- 受影响的规范：`workspace-ui`
- 受影响的代码：
  - `frontend/web/src/features/workspace/components/SourcesPanel.tsx`
  - `frontend/web/src/features/workspace/components/SearchResultsQueue.tsx`
  - `frontend/web/src/features/workspace/components/AddSearchResultDialog.tsx`
