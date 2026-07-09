# align-v2-shared-infrastructure — Tasks

## 1. Config 解析扩展

- [x] `shared/config.ts`: 定义 AiSettingsSchema (timeout/max_retries) + typed getter
- [x] `shared/config.ts`: 定义 ConcurrencySettingsSchema (embedding/vector_search/llm_generate) + typed getter
- [x] `shared/config.ts`: 定义 EmbeddingSettingsSchema (chunk_size/batch_size) + typed getter
- [x] `shared/config.ts`: 定义 ContextWindowSettingsSchema (max_tokens) + typed getter
- [x] `shared/config.ts`: 修正 search 段 key 路径 (search_engine → search.searxng)

## 2. Config 消费接入

- [x] `ai/middleware.ts`: retry 从 getAiSettings() 读 maxRetries（非 hardcode）
- [x] `ai/generate-output.ts`: completion_options 从 config 读 top_p/top_k/stop 透传
- [x] `rag/chunker.ts`: chunkSize 从 getEmbeddingSettings() 读（非 hardcode 800/100）
- [x] `rag/strategies/embed-strategy.ts`: batchSize 从 getEmbeddingSettings() 读（非 hardcode 32）
- [x] `features/tasks/worker.ts`: 并发数从 getConcurrencySettings() 读

## 3. retry 完整化

- [x] `ai/middleware.ts`: 补 408/409/425 到 RETRYABLE_CODES
- [x] `ai/middleware.ts`: 实现 parseRetryAfter（数字 + HTTP-date）
- [x] `ai/middleware.ts`: delay 计算先查 Retry-After header，否则指数退避
- [x] `ai/middleware.ts`: 加 max_delay cap（默认 10s）
- [x] `ai/middleware.ts`: 加 total_timeout 预算（AbortController + setTimeout）

## 4. searchVectors source_ids 过滤

- [x] `db/vectors.ts`: searchVectors 支持 sourceIds 参数（KNN 扩展 + post-filter 模式）
- [x] `rag/registry.ts`: RetrieveOptions.sourceIds 透传到 searchVectors（c38 的底层依赖）

## Verification

```bash
cd apps/server && bun test shared/config
cd apps/server && bun test ai
cd apps/server && bun test db/vectors
# retry: Retry-After 解析测试（数字 + HTTP-date）
# retry: 408/409/425 可重试测试
# retry: max_delay cap 测试
# config: 各段解析测试
# searchVectors: sourceIds 过滤测试
```
