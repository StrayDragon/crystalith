## 1. 基础设施准备

- [x] 1.1 添加 `trafilatura` 依赖到 `backend/py/pyproject.toml`
- [x] 1.2 添加 `playwright` 作为可选依赖 (`[browserless]` extra)
- [x] 1.3 创建 `backend/py/src/crystalith/extraction/` 模块目录

## 2. 核心模型定义

- [x] 2.1 创建 `extraction/types.py` 定义 `ExtractedContent` 数据类
- [x] 2.2 创建 `extraction/interfaces.py` 定义 `Extractor` 协议
- [x] 2.3 更新 `config/models.py` 添加 `WebExtractionSettings` 配置模型

## 3. 本地提取器实现

- [x] 3.1 创建 `extraction/trafilatura_extractor.py` 实现 `TrafilaturaExtractor`
- [x] 3.2 实现 Markdown 输出格式支持
- [x] 3.3 实现元数据提取（标题、作者、日期）
- [x] 3.4 编写单元测试 `tests/test_local_extractor.py`

## 4. 外部 API 提取器实现

- [x] 4.1 创建 `extraction/jina_extractor.py` 实现 `JinaReaderExtractor`
- [x] 4.2 创建 `extraction/firecrawl_extractor.py` 实现 `FirecrawlExtractor`
- [x] 4.3 实现 Jina Reader API 和 Firecrawl API 集成
- [x] 4.4 编写单元测试 `tests/test_api_extractor.py` 和 `tests/test_jina_extractor.py`
- [ ] 4.5 实现 `CustomApiExtractor` 支持自定义端点（延后，按需实现）

## 5. 浏览器渲染提取器实现

- [x] 5.1 创建 `extraction/browserless_extractor.py` 实现 `BrowserlessExtractor`
- [x] 5.2 实现 Playwright CDP 连接逻辑
- [x] 5.3 实现页面等待和内容提取
- [ ] 5.4 编写集成测试（需要 Browserless 服务，延后）

## 6. 提取器工厂和降级逻辑

- [x] 6.1 创建 `extraction/factory.py` 实现 `ExtractorFactory`
- [x] 6.2 实现智能降级逻辑（按配置顺序尝试）
- [ ] 6.3 实现提取结果缓存（可选，延后）
- [x] 6.4 编写集成测试 `tests/test_extraction_fallback.py`

## 7. API 集成

- [x] 7.1 修改 `api/sources.py` 的 `create_source_from_url` 使用新提取器
- [x] 7.2 保持 API 接口向后兼容
- [x] 7.3 添加提取方式到 Source 元数据
- [x] 7.4 添加 `/extractors` 端点列出可用提取器

## 8. 配置和文档

- [x] 8.1 更新 `config/app.yaml` 添加 `web_extraction` 配置节
- [x] 8.2 更新 `config/schema.json` 添加新配置的 JSON Schema
- [ ] 8.3 编写配置说明文档（延后）

## 9. 验证和收尾

- [x] 9.1 运行完整测试套件（79 个测试全部通过）
- [ ] 9.2 测试不同类型网页的提取效果（手动测试，延后）
- [ ] 9.3 性能测试和优化（延后）
- [ ] 9.4 更新 CHANGELOG（延后）
