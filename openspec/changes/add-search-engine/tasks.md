## 1. 搜索引擎抽象层

- [ ] 1.1 创建 `search/` 模块目录结构
- [ ] 1.2 定义 `SearchProvider` 抽象基类（包含 `search(query, mode) -> List[SearchResult]`）
- [ ] 1.3 定义 `SearchResult` 数据模型（title, url, snippet, source_type）

## 2. Web 搜索提供者实现

- [ ] 2.1 实现 `TavilySearchProvider`（优先）
- [ ] 2.2 实现 `DuckDuckGoSearchProvider`（免费 fallback）
- [ ] 2.3 创建 `SearchProviderFactory` 根据配置选择提供者
- [ ] 2.4 添加搜索结果缓存层（TTL 可配置）

## 3. API 集成

- [ ] 3.1 更新 `api/sources.py` 的搜索端点
- [ ] 3.2 支持 `mode` 参数（web/scholar/docs）
- [ ] 3.3 添加错误处理和友好提示

## 4. 配置与安全

- [ ] 4.1 更新 `config/app.yaml` 添加搜索引擎配置节
- [ ] 4.2 API Key 通过环境变量注入
- [ ] 4.3 添加配置验证

## 5. 测试

- [ ] 5.1 单元测试：模拟搜索 API 响应
- [ ] 5.2 集成测试：真实 API 调用（标记为 `@pytest.mark.integration`）
- [ ] 5.3 缓存命中率测试
