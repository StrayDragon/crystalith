# c40 Design — Shared 基础设施 v1 行为对齐

## Config 解析扩展

### v1 段映射 (`config/models.py`)

| v1 段                                              | v1 行为        | v2 当前              | 修复          |
| :------------------------------------------------- | :------------- | :------------------- | :------------ |
| `ai.timeout` / `ai.max_retries`                    | provider 传入  | hardcode 2/3         | 从 config 读  |
| `concurrency.embedding/vector_search/llm_generate` | Semaphore 限流 | hardcode 2/4/3       | 从 config 读  |
| `context_window.max_tokens`                        | token 预算     | hardcode             | 从 config 读  |
| `embedding.chunk_size/batch_size`                  | 分块/批量      | hardcode 800/100, 32 | 从 config 读  |
| `search.searxng.host/api_key/max_results`          | research 搜索  | key 名错误           | 修正 key 路径 |

### 方案

在 `shared/config.ts` 为这些段定义 Zod schema（对齐 v1 `models.py` 结构），从 raw bag 升级为类型安全读取。提供 typed getter：

```ts
getAiSettings(): { timeout?: number; maxRetries?: number }
getConcurrencySettings(): { embedding: number; vectorSearch: number; llmGenerate: number }
getEmbeddingSettings(): { chunkSize: number; batchSize: number }
```

**不做**: auth/rate_limit/cors 的完整实现（那是 c13 Server Mode 范围），只解析 config 让后续可用。

## retry 完整化

### v1 行为 (`retry.py`)

```python
run_with_retry(fn, *, max_retries, base_delay=1, max_delay=10, total_timeout=None):
    for attempt in range(max_retries):
        try:
            return await asyncio.wait_for(fn(), per_attempt_timeout)
        except RetryableError as e:
            if e.status_code not in RETRYABLE_CODES: raise
            delay = parse_retry_after(e.response) or min(base_delay * 2**attempt, max_delay)
            await asyncio.sleep(delay)
    raise
RETRYABLE_CODES = {408, 409, 425, 429, 500, 502, 503, 504}
```

### v2 修复 (`ai/middleware.ts`)

```ts
const RETRYABLE_CODES = [408, 409, 425, 429, 500, 502, 503, 504]; // 补 408/409/425

function computeDelay(response, attempt, baseMs, maxMs) {
  const retryAfter = parseRetryAfter(response.headers['retry-after']); // 数字 or HTTP-date
  if (retryAfter) return retryAfter;
  return Math.min(baseMs * 2 ** attempt, maxMs); // cap at maxMs
}

function parseRetryAfter(value) {
  const n = Number(value);
  if (!isNaN(n)) return n * 1000; // 秒 → ms
  const date = new Date(value); // HTTP-date
  return Math.max(0, date.getTime() - Date.now());
}
```

补 total_timeout 预算：用 AbortController + setTimeout。

## searchVectors source_ids 过滤

### v1 (`chroma.py:92,103-106`)

```python
where = {"$and": [{"notebook_id": notebook_id}]}
if source_ids: where["$and"].append({"source_id": {"$in": source_ids}})
```

### v2 修复 (`db/vectors.ts`)

sqlite-vec 的 vec0 表不支持复杂 WHERE，但可以在 KNN 查询后 post-filter：

```ts
async function searchVectors({ notebookId, queryVector, topK, sourceIds }) {
  // 先 KNN 搜 topK * 扩展因子，再按 sourceIds post-filter 到 topK
  const raw = knnSearch(notebookId, queryVector, sourceIds ? topK * 3 : topK);
  const filtered = sourceIds ? raw.filter((r) => sourceIds.includes(r.sourceId)) : raw;
  return filtered.slice(0, topK);
}
```

## completion_options 透传

v1 `factory.py:219`:

```python
model.generate(..., temperature=co.temperature, top_p=co.top_p, top_k=co.top_k, stop=co.stop)
```

v2 `generate-output.ts` 补：

```ts
const completionOpts = getCompletionOptions();  // 从 config 读
streamText({ ..., temperature: opts.temperature ?? completionOpts.temperature,
             topP: completionOpts.topP, stopSequences: completionOpts.stop });
```

## 不做的事

- auth/rate_limit/cors 实现（c13 Server Mode）
- RAG 编排器（retrieve_context 完整管线组装）— 规模大，独立评估
- assembly cache 的 TTL/LRU — 独立优化
- browserless extractor — 独立
