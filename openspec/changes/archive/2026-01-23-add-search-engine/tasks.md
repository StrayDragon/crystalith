## 1. 依赖与模块结构

- [x] 1.1 添加 `langchain-community` 依赖到 `pyproject.toml`
- [x] 1.2 创建 `search/` 模块（`__init__.py`, `types.py`）
- [x] 1.3 定义 `SearchResult` 数据模型（title, url, snippet, engine）

## 2. 搜索功能实现

- [x] 2.1 实现 `SearXNGSearcher` 类（封装 LangChain SearxSearchWrapper）
- [x] 2.2 实现 `async search(query, mode) -> List[SearchResult]` 方法
- [x] 2.3 支持搜索模式映射（Web/Scholar/Docs → 对应引擎列表）
- [x] 2.4 搜索失败时 fail-fast（抛出 RuntimeError 而非返回空列表）

## 3. 配置集成

- [x] 3.1 更新 `config/models.py` 添加 `SearchConfig` 模型
- [x] 3.2 更新 `config/app.yaml` 添加 `search.searxng` 配置节
- [x] 3.3 配置项：`host`、`api_key`（可选）、`timeout`、`max_results`

## 4. Search Graph 集成

- [x] 4.1 更新 `agents/search_graph.py` 导入搜索模块
- [x] 4.2 替换 `_build_stub_results` 为 `SearXNGSearcher.search()` 调用
- [x] 4.3 移除 fallback 逻辑，搜索失败时抛出异常

## 5. 后端 API 扩展

- [x] 5.1 添加 `POST /v1/notebooks/{notebook_id}/sources/from-url` 端点
- [x] 5.2 支持 `mode=link`：仅保存 URL + 标题 + 摘要作为轻量来源
- [x] 5.3 支持 `mode=fetch`：获取网页内容并解析为完整来源
- [x] 5.4 复用 `HTMLParser` 解析网页内容

## 6. 前端组件实现

- [x] 6.1 创建 `SearchResultCard` 胶囊组件（显示标题、摘要、来源、复选框）
- [x] 6.2 创建 `SearchResultsQueue` 队列组件（多结果展示、全选、操作按钮）
- [x] 6.3 创建 `AddSearchResultDialog` 对话框（批量添加进度显示）
- [x] 6.4 扩展 `useSources` hook 支持 `addSourceFromUrl` 和 `clearSearchResults`
- [x] 6.5 添加 `addSourceFromUrl` API client
- [x] 6.6 集成到 `SourcesPanel`，替换简单卡片列表为队列组件

## 7. 测试

- [x] 7.1 后端单元测试：模拟 SearxSearchWrapper 响应
- [ ] 7.2 集成测试：真实 SearXNG 调用（标记为 `@pytest.mark.integration`）
- [ ] 7.3 前端组件测试

## 8. UI/UX 改进

- [x] 8.1 搜索结果队列化展示（类似 Studio 笔记，蓝色主题，可折叠）
- [x] 8.2 搜索结果点击展开二级页面（Dialog 显示详情和操作）
- [x] 8.3 紧凑卡片模式（compact mode），每行显示标题+来源+菜单
- [x] 8.4 单个结果快速操作（右键菜单：保存链接/获取内容/打开链接）
- [x] 8.5 全屏查看模式（单列布局，每个结果带操作按钮）
- [x] 8.6 操作按钮语义化命名（"作为链接导入"/"作为全文导入"）
- [x] 8.7 Tooltip 提示按钮功能说明
