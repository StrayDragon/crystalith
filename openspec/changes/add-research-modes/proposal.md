## Why

当前搜索功能只支持基础的 Web 搜索模式，用户无法选择不同的研究深度和搜索引擎类型。用户在进行研究时需要不同的搜索策略：

1. **快速搜索 (Fast Research)** - 快速获取关键结果，适合快速查找和验证
2. **深度搜索 (Deep Research)** - 多轮迭代搜索，适合深入研究和全面调研
3. **搜索引擎选择** - 支持选择特定搜索引擎（Google、Bing、DuckDuckGo 等）

## What Changes

### 后端
- 添加研究模式配置（fast/deep）
- 实现 Deep Research 模式的多轮迭代搜索逻辑
- 支持搜索引擎选择参数

### 前端
- 实现搜索模式选择器 UI（Web/Fast Research/Deep Research）
- 添加搜索引擎选择下拉菜单
- Deep Research 模式显示搜索进度和中间结果
- 搜索模式切换时的 UI 状态管理

## Impact

- 受影响的规范：`search-engine`（修改）、`research-modes`（新增）
- 受影响的代码：
  - `backend/py/src/crystalith/search/` - 搜索模块
  - `backend/py/src/crystalith/api/sources.py` - 搜索 API
  - `frontend/web/src/features/workspace/components/SourcesPanel.tsx` - 搜索面板
  - `frontend/web/src/features/workspace/hooks/useSources.ts` - 搜索 Hook
