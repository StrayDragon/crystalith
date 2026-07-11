# fix-v2-sources-search-and-extractors — Tasks

## 1. /search 接入真 web search

- [ ] `features/sources/router.ts:544`: 替换 RAG placeholder 为调用 ai/tools/web-search.ts 的 SearXNG client
- [ ] 返回 SourceSearchResponse 结构（含 message/created_at/engine/results）

## 2. /extractors 完整响应

- [ ] `features/sources/router.ts:741`: 实现 ExtractorsListResponse（per-extractor available/display_name/priority/requires_api_key/recovery_hint）
- [ ] `shared/extraction/factory.ts`: 加 getAvailableExtractors() 能力报告

## 3. dedup 配置门控

- [ ] `shared/config.ts`: 加 getDedupEnabled() 读取 source_ingestion.dedup.enabled
- [ ] `features/sources/router.ts:249,640`: dedup 前检查 getDedupEnabled()

## 4. re-embed 强制 FAILED

- [ ] `features/sources/router.ts:510`: 校验 status==='failed'，否则 400

## 5. batch 端点对齐

- [ ] `features/sources/router.ts:564`: 改 POST /batch/delete 为 DELETE /batch
- [ ] batch re-embed + delete 返回 per-item results 数组（error_code/message）

## 6. summary/QA 400 + 归属校验

- [ ] `features/sources/source-extras.router.ts`: "not ready" 返回 400（非 NotFoundError 404）
- [ ] summary/QA/qa-to-source 校验 source.notebookId === nid

## 7. qa-to-source 契约对齐

- [ ] `features/sources/source-extras.router.ts:206`: 接受 messages:[QAMessage] 列表（非 {question,answer}）
- [ ] 格式化为 markdown 后创建 source

## 8. connector binding JSON schema 校验

- [ ] `features/source-connectors/router.ts:201`: 对 connection_config 做 JSON schema 校验

## 9. connector 不可用 409 + hint

- [ ] `features/source-connectors/router.ts:107`: 返回 409 + hint + plugin_diagnostic（非 404）

## 10. tag binding response + 归属

- [ ] `features/sources/router.ts:432,463`: 返回 {count, results:[SourceBatchItemResult]}
- [ ] DELETE binding 校验 source 属于 notebook

## Verification

```bash
cd apps/server && bun test features/sources
# /search 返回 web 结果（需 SearXNG mock）
# /extractors 返回完整 ExtractorsListResponse
# re-embed ready source 返回 400
# summary not-ready 返回 400
# batch delete 用 DELETE 方法
```
