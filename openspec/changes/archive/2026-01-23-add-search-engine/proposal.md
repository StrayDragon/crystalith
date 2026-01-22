## Why

当前 `api/sources.py` 中的搜索功能返回模拟数据，未接入真实搜索引擎。用户需要通过 Web/Scholar/Docs 搜索来发现和添加外部来源，这是 NotebookLM 架构的核心能力之一。

## What Changes

### 后端
- 新增 `backend/py/src/crystalith/search/` 模块，封装搜索引擎抽象层
- 实现 SearXNG 搜索提供者（自托管元搜索引擎，支持多种后端引擎）
- 更新 `agents/search_graph.py`，调用真实搜索引擎替换模拟数据
- 新增 `POST /v1/notebooks/{notebook_id}/sources/from-url` 端点，支持从 URL 添加来源
- 搜索失败时 fail-fast（抛出异常而非静默返回空列表）

### 前端
- 新增 `SearchResultCard` 胶囊组件，显示搜索结果卡片
- 新增 `SearchResultsQueue` 队列组件，支持多选和批量操作
- 新增 `AddSearchResultDialog` 对话框，显示批量添加进度
- 扩展 `useSources` hook 支持从 URL 添加来源
- 更新 `SourcesPanel`，使用新的队列组件替换简单列表

### 为什么选择 SearXNG

1. **隐私优先**：SearXNG 不追踪用户，符合隐私保护理念
2. **自托管**：可部署在本地或私有服务器，无需依赖第三方 API
3. **免费无限制**：无 API 配额限制，无需付费
4. **多引擎聚合**：可配置聚合 Google、Bing、DuckDuckGo 等多个搜索引擎
5. **JSON API**：原生支持 JSON 格式输出，便于程序集成
6. **灵活配置**：支持按类别（web/scholar/images/news）搜索

## Impact

- 受影响的规范：
  - `search-engine`（新增搜索引擎集成能力）
  - `workspace-ui`（搜索结果展示和交互）
- 受影响的代码：
  - `backend/py/src/crystalith/agents/search_graph.py`
  - `backend/py/src/crystalith/api/sources.py`（新增 from-url 端点）
  - 新增 `backend/py/src/crystalith/search/` 模块
  - `frontend/web/src/features/workspace/components/SourcesPanel.tsx`
  - 新增 `frontend/web/src/features/workspace/components/SearchResultCard.tsx`
  - 新增 `frontend/web/src/features/workspace/components/SearchResultsQueue.tsx`
  - 新增 `frontend/web/src/features/workspace/components/AddSearchResultDialog.tsx`
  - `frontend/web/src/features/workspace/hooks/useSources.ts`
  - `frontend/web/src/api/client.ts`
- 依赖关系：此变更为 T07（智能建议问题）和 T08（跨文档分析）提供基础能力
- 外部依赖：需要一个可用的 SearXNG 实例（可自托管或使用公共实例）
