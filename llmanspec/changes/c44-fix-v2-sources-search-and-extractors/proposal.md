---
depends_on: [c39-align-v2-sources-and-sessions]
batch: all
---

# c44-fix-v2-sources-search-and-extractors — Sources 搜索/提取器/契约对齐

## Why

c39 标 DONE，但 2026-07-11 第三轮复核发现 sources 域仍有 2 个 P0 + 8 个 P1 契约/安全偏离：

- **/search 是 RAG placeholder** [P0]: v1 `api_ingest.py:268` 调 `run_search_graph()`（`search_graph.py`）做真 web search（SearXNG）。v2 `router.ts:544` 返回 notebook 内向量匹配。已有 SearXNG client（`ai/tools/web-search.ts`，research agent 在用）未接入。
- **/extractors 只返回存储行** [P0]: v1 `api_ingest.py:79-153` 返回 `ExtractorsListResponse`（每提取器 available/display_name/priority/requires_api_key/recovery_hint + default_extractor + fallback_enabled）。v2 `router.ts:741` 只返回 `{notebookId, mode, enabledExtractors}`。
- **dedup 无视配置** [P1]: v2 dedup 恒开（`router.ts:249,640`）。v1 受 `settings.source_ingestion.dedup.enabled` 门控。
- **re-embed 不强制 FAILED** [P1]: v1 `_reembed_existing_source` 拒绝非 FAILED（400）。v2 允许 re-embed 任何状态。
- **batch DELETE 方法错** [P1]: v1 `DELETE /batch`；v2 `POST /batch/delete`。且无 per-item `results` 数组（`error_code`/`message`）。
- **summary/QA 返回 404 而非 400** [P1]: v1 "not ready" 返回 400；v2 返回 404。且不校验 notebook 归属。
- **qa-to-source 契约不同** [P1]: v1 接受 `messages:[QAMessage]` 列表；v2 接受 `{question, answer}` 单轮。
- **connector binding 无 JSON schema 校验** [P1]: v1 `_validate_with_jsonschema`；v2 直接存任意 config。
- **connector 不可用返回 404 非 409** [P1]: v1 返回 409 + install hint + diagnostic；v2 返回 404。
- **tag binding response shape 偏离** [P1]: v1 `{count, results:[SourceBatchItemResult]}`；v2 `{applied, skipped}`。DELETE binding 不校验 notebook 归属。

## What Changes

1. **/search 接入真 web search**: 复用 `ai/tools/web-search.ts` 的 SearXNG client，返回 `SourceSearchResponse` 结构
2. **/extractors 完整响应**: 返回每提取器 available/display_name/priority/requires_api_key/recovery_hint + default_extractor + fallback_enabled
3. **dedup 配置门控**: 读 `dedup.enabled`，为 false 时跳过 dedup
4. **re-embed 强制 FAILED**: 非 FAILED 返回 400
5. **batch 端点对齐**: DELETE /batch + per-item results 数组
6. **summary/QA 400 + 归属校验**: "not ready" 返回 400；校验 source.notebookId === nid
7. **qa-to-source 契约对齐**: 接受 messages 列表 + markdown 格式化
8. **connector binding JSON schema 校验**
9. **connector 不可用 409 + hint**
10. **tag binding response shape + 归属校验**

## Capabilities

- source-ingestion-upload-and-url（spec delta: /search 真实现 + dedup 配置门控）
- web-extractor-plugins（spec delta: /extractors 完整 ExtractorsListResponse）
- source-ingestion-management-and-tags（spec delta: batch 方法/per-item results + tag binding shape + 归属）
- source-ingestion-summary-and-conversion（spec delta: summary/QA 400 + 归属 + qa-to-source 契约）
- source-connectors（spec delta: binding JSON schema 校验 + 不可用 409）

## Impact

- /search 从 RAG placeholder 变为真 web search（需 SearXNG 可用，否则优雅降级）
- batch DELETE 方法变化（BREAKING v2 内部）
- summary/QA 错误码从 404 变 400
