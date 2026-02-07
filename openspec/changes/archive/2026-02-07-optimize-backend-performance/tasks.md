## 1. 向量搜索 ANN 优化

- [x] 1.1 审查 `shared/vector_storage/sqlite.py` 和 `shared/vector_storage/chroma.py` 的 search 实现，确认 Chroma 是否已使用原生 query
- [x] 1.2 修改 Chroma 向量存储的 `search` 方法，确保直接调用 `collection.query()` 而非加载全量条目后暴力搜索
- [x] 1.3 添加 `source_id_set` 过滤参数的 Chroma where 条件支持
- [x] 1.4 编写对比基准测试：100/500/1000 个条目下 ANN vs 暴力搜索的延迟和召回率
- [x] 1.5 验证：运行基准测试，ANN 搜索延迟 < 暴力搜索的 50%，召回率 > 95%

## 2. 嵌入批处理与缓存

- [x] 2.1 在 `EmbeddingProvider` 接口添加 `embed_batch(texts, batch_size=100)` 方法
- [x] 2.2 实现 OpenAI provider 的 `embed_batch`：按 batch_size 分片，串行调用各分片
- [x] 2.3 实现 Ollama provider 的 `embed_batch`：相同分片逻辑
- [x] 2.4 添加基于内容 SHA256 的 LRU 缓存层（`EmbeddingCache` 类，maxsize=10000）
- [x] 2.5 将 `features/sources/api.py` 中的 `embedder.embed()` 替换为 `embed_batch()`
- [x] 2.6 编写单元测试：验证批处理分片正确性、缓存命中/未命中逻辑
- [x] 2.7 验证：上传 500 chunk 文档，对比优化前后的嵌入耗时（预期 3-5x 提升）

## 3. RAG Q&A 管道并行化

- [x] 3.1 在 `features/qa/api.py` 中识别可并行的操作对：(embed, history_fetch) 和 (chunk_fetch, context_build)
- [x] 3.2 使用 `asyncio.gather` 重构问题嵌入与会话历史获取为并行
- [x] 3.3 验证流式 QA (`/qa/stream`) 同样受益于并行化
- [x] 3.4 编写集成测试：验证并行化后 QA 结果一致性（answer + citations 不变）
- [x] 3.5 验证：对比优化前后 QA 端到端延迟（预期降低 30-40%）

## 4. 跨文档分析优化

- [x] 4.1 重构 `features/analysis/correlation.py`：使用向量存储的 top-k 搜索替代全对比较
- [x] 4.2 添加 `exclude_source_id` 参数到向量存储 search 接口（仅返回不同 source 的结果）
- [x] 4.3 重构 `features/analysis/contradiction.py`：使用 `asyncio.gather` + `Semaphore(5)` 并行 LLM 调用
- [x] 4.4 编写单元测试：验证关联检测结果与原暴力算法一致性（>90% 重叠）
- [x] 4.5 验证：10 个 source、200 chunk 场景下，分析耗时降低 >50%

## 5. Source 解析异步化

- [x] 5.1 在 `features/sources/api.py` 的 upload/from-url 流程中，将 `parser.parse()` 包装在 `run_in_executor`
- [x] 5.2 确认 PDF/HTML 解析器线程安全性
- [x] 5.3 编写测试：上传大 PDF（>100 页）时，API 服务器不阻塞其他请求
- [x] 5.4 验证：并发上传 3 个文档，每个请求的响应时间不因其他请求阻塞而显著增加

## 6. AI Provider 超时与重试

- [x] 6.1 在 `shared/ai/` 的 provider 基类中添加 `timeout` 和 `max_retries` 配置
- [x] 6.2 实现指数退避重试逻辑（initial=1s, max=10s, factor=2）
- [x] 6.3 在 `config/schema.json` 中添加 `ai.timeout` 和 `ai.max_retries` 配置项
- [x] 6.4 编写单元测试：模拟超时/限流场景，验证重试行为
- [x] 6.5 验证：手动模拟 AI provider 超时，确认重试后成功返回

## 7. 批量 Refine 并行化

- [x] 7.1 在 `features/refine/api.py` 中将多格式串行 LLM 调用改为 `asyncio.gather`
- [x] 7.2 添加 `Semaphore` 控制并发数（默认 3），避免触发 provider 限流
- [x] 7.3 编写测试：批量 refine 3 种格式，验证结果与串行一致
- [x] 7.4 验证：对比优化前后批量 refine 耗时（预期降低 60-70%）
