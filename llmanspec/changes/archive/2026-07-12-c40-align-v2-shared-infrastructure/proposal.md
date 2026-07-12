---
depends_on: [c24-add-v2-pipeline-integration]
batch: all
---

# c40-align-v2-shared-infrastructure — Shared 基础设施 v1 行为对齐

## Why

c25 (ssrf-config) 标 DONE，但 2026-07-10 对拍发现 shared 基础设施层存在系统性偏离：

### Config 解析 [P0]

v1 解析 ~20 个配置维度（`config/models.py:917-999`）。v2 只解析 models 段 + 2 个 ad-hoc（SSRF/upload_max_bytes）。以下被完全忽略：

- `app.auth`（API key 门控）— v2 无任何鉴权
- `app.http_guardrails.rate_limit` — v2 无限流
- `ai.timeout` / `ai.max_retries` — v2 hardcode
- `concurrency`（embedding/vector_search/llm_generate）— v2 hardcode 且值与 v1 不同
- `context_window`（max_tokens/compression/priority）— v2 hardcode
- `embedding`（chunk_size/batch_size）— v2 hardcode
- `search` — v2 读的 key 名错误（`search_engine` vs `search.searxng.host`）

### Retry/Timeout [P1]

- **retry 忽略 Retry-After 头**: v1 解析 Retry-After（数字+HTTP-date）并遵守（`retry.py:84-128`）。v2 纯指数退避（`middleware.ts:47`）。
- **少 3 个可重试状态码**: v1 = {408,409,425,429,500,502,503,504}。v2 = {429,500,502,503,504}。缺 408/409/425。
- **无超时预算**: v1 有 per-attempt + total timeout（`retry.py:147-204`）。v2 无。
- **无 max_delay cap**: v1 cap 10s。v2 无上限。

### Vector Store [P1]

- **searchVectors 不支持 source_ids 过滤** (`vectors.ts:73-93`): v1 chroma 支持。v2 只按 notebook_id。这是 c38 source-scoping 的底层依赖。

### completion_options [P1]

v1 从 config 读 temperature/top_p/top_k/stop/reasoning（`factory.py:219`）。v2 只传 temperature + maxOutputTokens。

## What Changes

1. **Config 解析扩展**: 补解析 ai/concurrency/context_window/embedding/search 段（从 ad-hoc raw 读改为 Zod 校验）
2. **retry 完整化**: 补 Retry-After 解析 + 408/409/425 状态码 + timeout 预算 + max_delay cap
3. **searchVectors source_ids**: 向量搜索层支持 sourceIds WHERE 过滤
4. **completion_options 透传**: 从 config 读 top_p/top_k/stop/reasoning 传入 generate 调用

## Capabilities

- retrieval-and-cache (spec delta: vector search source_ids 过滤)
- generation-observability-and-guardrails (spec delta: retry/timeout 策略 + completion_options)

## Impact

- config.yaml 中更多段被实际解析和消费
- retry 行为更健壮（遵守 Retry-After，有超时预算）
- 向量搜索支持 source 范围过滤（c38 的底层依赖）
