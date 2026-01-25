## Why

当用户有多个来源时，系统目前无法自动发现来源之间的关联、共同主题或潜在矛盾。跨文档分析能力可以帮助用户更好地综合理解多个来源的信息。

## What Changes

- 新增跨文档分析模块
- 实现多来源关联检测
- 实现主题聚类
- 实现矛盾点检测

## Impact

- 受影响的规范：新增 `cross-document-analysis` 规范
- 受影响的代码：
  - 新增 `backend/py/src/crystalith/analysis/` 模块
  - 新增 `frontend/web/src/features/workspace/components/AnalysisPanel.tsx`
- 依赖关系：依赖 T01（搜索引擎接入）和 T02（向量存储优化）
