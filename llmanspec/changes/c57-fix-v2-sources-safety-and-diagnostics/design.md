# c57 Design — sources 安全归属 + 诊断丰富度 + connector dedup 门控

> SSOT: `backend/py/src/crystalith/features/sources/{api_sources,api_common,api_ingest,api_tags,api_schemas}.py` + `source_connectors/api.py`

## 决策

### D1: 单 source 路由改为 notebook 嵌套路径

v2 当前 `GET/DELETE /sources/:id` 等扁平路径无法做归属校验（路径里没有 notebook id）。两个选项：

- **(A) 改路径为 `/notebooks/:nid/sources/:id`**（对齐 v1 嵌套）—— BREAKING 但语义最清晰
- **(B) 保留 `/sources/:id` 但加必需 `?notebook_id=` query**—— 非 BREAKING 但语义弱

选 **(A)**：v1 parity 优先，且 PROGRESS 记录前端迁移进行中（这些端点的前端消费尚未固化）。路由路径与 v1 一致降低长期维护成本。同时保留旧的 `/sources/:id` 作为内部别名（重定向到嵌套）不必要——直接迁移。

### D2: connector dedup 门控复用 sources 的 getDedupEnabled()

v1 `source_connectors/api.py:898,1070` 和 `sources/api_ingest.py:777,341` 共享同一配置键 `settings.source_ingestion.dedup.enabled`。v2 `sources/router.ts` 已有 `getDedupEnabled()`。connector sync.ts 直接 import 复用，不重复定义。

### D3: batch results 形状逐字移植 v1 SourceBatchItemResult

```
SourceBatchItemResult = { source_id: number, ok: boolean, error_code?: string, message?: string }
SourceBatchReembedResponse = { results: SourceBatchItemResult[], reembedded_ids: number[], failed_ids: number[], reembedded_count: number, failed_count: number }
SourceBatchDeleteResponse = { results: SourceBatchItemResult[], deleted_ids: number[], deleted_count: number }
```

results 数组包含所有请求项（成功+失败），便于客户端逐项展示。

### D4: ingestion 失败诊断 4-stage 移植 v1

v1 `api_ingest.py:893-924` 的 4 stage：

- `SOURCE_ERROR_PARSER_FAILED`（parse 阶段）
- `SOURCE_ERROR_EMBEDDING_FAILED`（embed 阶段）
- `SOURCE_ERROR_VECTOR_STORE_FAILED`（vector_store.add 阶段）
- `SOURCE_ERROR_INGESTION_FAILED`（其他/兜底）

每个 stage 附带 `recovery_hint`（中文恢复建议）+ `last_error_at`（ISO timestamp）。v2 pipeline.ts 当前只有 parse/embed 两阶段，需拆分 embed→embed+vector_store（因为 `triggerEmbedding` 内部先 embedBatch 再 insertChunkVector，vector_store 失败应单独捕获）。

### D5: re-embed 清字段

v2 re-embed 设 status=processing 时，清 `errorCode=null, errorMessage=null, recoveryHint=null, lastErrorAt=null`（4 字段全清，对齐 v1 `api_common.py:261-263`）。

### D6: tag 缓存失效

v2 tag CRUD（create/update/delete）和 bind/unbind 末尾调 `bumpSourcesEpoch(nid)`。复用 sources/router.ts 已有的 epoch 机制。注意：tag 本身不涉及 vector epoch（不改向量），只 bump sources epoch（因为 list-sources 缓存键含 tag 过滤）。

## 涉及文件

### 修改

- `apps/server/src/features/sources/router.ts` —— 4 单 source 路由改嵌套 + 归属校验；batch 加 results；re-embed 清字段；tag 操作 bump epoch
- `apps/server/src/features/sources/pipeline.ts` —— 失败诊断 4-stage + recovery_hint + last_error_at
- `apps/server/src/features/source-connectors/sync.ts` —— dedup 门控 getDedupEnabled()
- `packages/shared/src/schemas/source.ts` —— +SourceBatchItemResultSchema（如果 shared schemas 有 batch 响应）

### 新增测试

- `apps/server/test/sources/ownership.test.ts` —— 跨 notebook 访问返回 404
- `apps/server/test/source-connectors/dedup-gate.test.ts` —— 关闭 dedup 时新建 source
- `apps/server/test/sources/batch-results.test.ts` —— batch 响应含 results 数组
- `apps/server/test/sources/reembed-clear.test.ts` —— re-embed 清 4 字段
- `apps/server/test/sources/ingestion-diagnostics.test.ts` —— 4-stage error codes
- `apps/server/test/sources/tag-cache-invalidation.test.ts` —— tag 变更 bump epoch
