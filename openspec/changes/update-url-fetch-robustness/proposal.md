## Why

当前从 URL 获取网页内容的功能存在两个问题：

1. **UI 层叠错误**：当用户在全屏搜索结果对话框内点击"作为全文导入"按钮时，进度对话框 (`AddSearchResultDialog`) 与全屏对话框产生 z-index 冲突，导致进度条显示在错误位置或被遮挡。

2. **网页抓取失败**：后端使用 `httpx` 直接请求网页时返回 400 Bad Request，原因可能包括：
   - 缺少合适的 HTTP 请求头（如 User-Agent）
   - 目标网站实施了反爬虫措施
   - 某些网页需要 JavaScript 渲染才能获取内容
   - 网络环境可能需要代理配置

## What Changes

### 前端 (workspace-ui)
- 修复 `AddSearchResultDialog` 的 z-index，确保在全屏对话框之上正确显示
- 调整对话框打开逻辑，当从全屏模式触发时先关闭全屏对话框

### 后端 (source-ingestion)
- 添加更真实的 HTTP 请求头（User-Agent、Accept 等）
- 配置可选的代理支持（通过 `config/app.yaml` 配置）
- 添加请求重试机制和更友好的错误提示
- **BREAKING** (未来考虑)：引入可选的浏览器自动化方案（如 playwright）用于复杂网页抓取

## Impact

- 受影响的规范：
  - `workspace-ui` - 对话框层叠行为
  - `source-ingestion` - URL 内容获取机制
- 受影响的代码：
  - `frontend/web/src/features/workspace/components/AddSearchResultDialog.tsx`
  - `frontend/web/src/features/workspace/components/SearchResultsQueue.tsx`
  - `frontend/web/src/features/workspace/components/SourcesPanel.tsx`
  - `backend/py/src/crystalith/api/sources.py`
  - `backend/py/src/crystalith/config/models.py` (新增代理配置)
