## Why

当前系统不提供智能问题建议，用户需要自行思考要提出什么问题。根据来源内容自动生成建议问题可以降低用户的认知负担，帮助用户更好地探索和理解材料。

## What Changes

- 新增智能建议问题 API 端点
- 在 Chat 面板显示建议问题卡片
- 支持建议刷新功能

## Impact

- 受影响的规范：新增 `smart-suggestions` 规范
- 受影响的代码：
  - 新增 `backend/py/src/crystalith/api/suggestions.py`
  - 新增 `frontend/web/src/features/workspace/components/SuggestionChips.tsx`
  - 更新 `frontend/web/src/features/workspace/components/ChatPanel.tsx`
- 依赖关系：依赖 T01（搜索引擎接入）增强上下文
