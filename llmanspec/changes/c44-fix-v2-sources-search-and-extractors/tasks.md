# fix-v2-sources-search-and-extractors — Tasks

## 1. /search 接入真 web search

- [x] `features/sources/router.ts`: 替换 RAG placeholder 为调用 ai/tools/web-search.ts 的 searchWeb
- [x] `ai/tools/web-search.ts`: 提取 searchWeb 独立函数（非 tool wrapper）
- [x] 返回 SourceSearchResponse 结构（含 created_at/engine/results）

## 2. /extractors 完整响应

- [x] `features/sources/router.ts`: 实现 ExtractorsListResponse（per-extractor available/display_name/priority/requires_api_key/recovery_hint + default_extractor + fallback_enabled）

## 3. dedup 配置门控

- [x] `shared/config.ts`: 加 getDedupEnabled() 读取 source_ingestion.dedup.enabled
- [x] `features/sources/router.ts`: upload + from-url dedup 前检查 getDedupEnabled()

## 4. re-embed 强制 FAILED

- [x] `features/sources/router.ts`: 校验 status==='failed'，否则 400

## 5. summary/QA 400 + 归属校验

- [x] `features/sources/source-extras.router.ts`: "not ready" 返回 400（非 404）
- [x] summary/QA/qa-to-source 校验 source.notebookId === nid

## 6. connector 不可用 409 + hint

- [x] `features/source-connectors/router.ts`: getConnectorOr404 返回 409 + hint + plugin_diagnostic（非 404）

## Verification

```bash
cd apps/server && bun typecheck  # ✅ pass
cd apps/server && bun test       # ✅ 209 pass / 2 fail (network timeout, no regression)
```

## 未做（P1 但影响小，可后置）

- batch DELETE 方法改 DELETE（前端依赖 POST 路径，改 method 是 BREAKING；留待 c14 统一清理）
- batch per-item results 数组（当前 reembedded_ids/failed_ids 已足够）
- tag binding response shape（当前 applied/skipped 已可用）
- qa-to-source messages 列表契约（当前单轮 {question,answer} 已可用）
- connector binding JSON schema 校验（当前 binding config 较简单）
