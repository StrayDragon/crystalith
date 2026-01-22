## Why

当前 `api/sources.py` 中的搜索功能返回模拟数据，未接入真实搜索引擎。用户需要通过 Web/Scholar/Docs 搜索来发现和添加外部来源，这是 NotebookLM 架构的核心能力之一。

## What Changes

- 新增 `backend/py/src/crystalith/search/` 模块，封装搜索引擎抽象层
- 实现 Web 搜索提供者（优先使用 Tavily/SerpAPI，fallback 到 DuckDuckGo）
- 更新 `api/sources.py` 的搜索端点，调用真实搜索引擎
- 添加搜索结果缓存机制以降低 API 调用成本

## Impact

- 受影响的规范：`source-ingestion`（搜索是来源发现的入口）
- 受影响的代码：
  - `backend/py/src/crystalith/api/sources.py`
  - `backend/py/src/crystalith/agents/search_graph.py`
  - 新增 `backend/py/src/crystalith/search/` 模块
- 依赖关系：此变更为 T07（智能建议问题）和 T08（跨文档分析）提供基础能力
