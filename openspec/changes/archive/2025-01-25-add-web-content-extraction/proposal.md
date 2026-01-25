## Why

当前系统的网页内容抓取能力有限：
1. 仅使用 `httpx` + `BeautifulSoup` 进行简单 HTML 解析，无法处理 JavaScript 渲染的页面
2. 许多现代网站（SPA、动态加载内容）无法正确提取
3. 缺乏对复杂网页结构的智能提取能力
4. 没有统一的网页内容提取策略和降级机制

为了支持"全文导入"功能，需要引入更强大的网页内容提取方案。

## What Changes

### 后端 (source-ingestion)

引入分层的网页内容提取策略：

1. **本地轻量级提取（默认）**
   - 集成 `trafilatura` 库替代当前的 BeautifulSoup 方案
   - 更好的正文提取、元数据提取、噪音过滤

2. **外部 API 服务（可选）**
   - 支持 Jina Reader API (`r.jina.ai`) - 免费额度，返回 Markdown
   - 支持 Firecrawl API - 付费服务，功能更强大
   - 通过配置切换，支持自定义 API 端点

3. **浏览器渲染（可选，高级）**
   - 支持连接 Browserless 服务（自托管 Docker）
   - 使用 Playwright 处理 JavaScript 渲染页面
   - 作为降级方案处理复杂网页

4. **智能降级机制**
   - 本地提取失败 → 尝试外部 API → 尝试浏览器渲染
   - 可配置降级策略和超时

### 配置 (config-management)

- 新增 `web_extraction` 配置节
- 支持多种提取器的启用/禁用和优先级配置
- API 密钥和端点配置

## Impact

- 受影响的规范：
  - `source-ingestion` - 新增网页内容提取能力
  - `config-management` - 新增配置项
- 受影响的代码：
  - `backend/py/src/crystalith/parsers/` - 新增提取器
  - `backend/py/src/crystalith/api/sources.py` - 修改 URL 抓取逻辑
  - `backend/py/src/crystalith/config/models.py` - 新增配置模型
  - `config/app.yaml` - 新增配置节
