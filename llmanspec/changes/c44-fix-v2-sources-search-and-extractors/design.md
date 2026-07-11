# c44 Design — Sources 搜索/提取器/契约对齐

## v1 行为契约 (SSOT: `backend/py/.../sources/` + `source_connectors/`)

### /search 真实现 (api_ingest.py:268 + search_graph.py)

v1: `run_search_graph()` 调 SearXNG 返回 web 结果，创建 source。
v2 根因: `sources/router.ts:544` 返回 notebook 内向量匹配（RAG placeholder）。已有 SearXNG client `ai/tools/web-search.ts:37`（research agent 在用）未接入。

### /extractors 完整响应 (api_ingest.py:79-153)

v1 `ExtractorsListResponse`: 每提取器 available/display_name/priority/requires_api_key/recovery_hint + default_extractor + fallback_enabled。
v2 根因: `router.ts:741` 只返回存储的策略行。

### dedup 配置门控

v1: `settings.source_ingestion.dedup.enabled`。
v2 根因: dedup 恒开，无视配置。

### batch 端点 (api_sources.py:126,245)

v1: `DELETE /batch`（非 POST）；返回 per-item `results:[SourceBatchItemResult]`。
v2: `POST /batch/delete`；无 per-item results。

### summary/QA 错误码 + 归属

v1: "not ready" → 400；校验 `source.notebook_id != notebook_id` → 404。
v2: "not ready" → 404；不校验归属。

### qa-to-source (api_qa.py:204)

v1: 接受 `messages:[QAMessage]` + `_format_qa_messages_as_markdown`。
v2: 接受 `{question, answer}` 单轮。

## v2 对齐方案

### /search 接入 web search

```ts
const results = await searxngSearch(query, { num: limit });
// 创建 source → chunk → embed
return { results, message, created_at, engine: 'searxng' };
```

SearXNG 不可用时优雅降级（返回空 + 错误信息，非崩溃）。

### /extractors 完整响应

`shared/extraction/factory.ts` 加 `getAvailableExtractors()`:

```ts
return extractors.map((name) => ({
  name,
  available: checkAvailable(name),
  display_name,
  priority,
  requires_api_key,
  recovery_hint,
}));
```

### dedup 门控

`shared/config.ts` 加 `getDedupEnabled()`。upload/from-url 前检查。

### batch DELETE + per-item

改 method 为 DELETE；返回 `{ results: [{ source_id, success, error_code?, message? }] }`。

## 不做的事

- 不改 source CRUD 基础逻辑（c39 已对齐）
- connector sync-check/apply/import-scope 已是 faithful port（不复工）
