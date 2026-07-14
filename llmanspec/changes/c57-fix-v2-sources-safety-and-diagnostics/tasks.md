# c57 Tasks

## 1. P0-A: 单 source 路由 notebook 归属校验

- [ ] 1.1 `apps/server/src/features/sources/router.ts`: `GET /sources/:id` → `GET /notebooks/:nid/sources/:sid`，查 source 后校验 `source.notebookId === Number(params.nid)`，不匹配抛 404
- [ ] 1.2 `DELETE /sources/:id` → `DELETE /notebooks/:nid/sources/:sid`，同归属校验
- [ ] 1.3 `POST /sources/:id/re-embed` → `POST /notebooks/:nid/sources/:sid/re-embed`，同归属校验
- [ ] 1.4 `GET /sources/:id/chunks` → `GET /notebooks/:nid/sources/:sid/chunks`，同归属校验
- [ ] 1.5 更新 openapi doc 注册（apiDocs 路径）

## 2. P0-B: connector dedup 配置门控

- [ ] 2.1 `apps/server/src/features/source-connectors/sync.ts`: `ingestConnectorEntry` 内 `checkDedup` 调用包裹 `if (getDedupEnabled())`（import 自 sources/router.ts 或 shared config）
- [ ] 2.2 关闭配置时直接跳过 dedup，总是创建新 source

## 3. P1: batch per-item results

- [ ] 3.1 batch re-embed 响应加 `results: SourceBatchItemResult[]`（每项 `{source_id, ok, error_code?, message?}`），保留 reembedded_ids/failed_ids/counts
- [ ] 3.2 batch delete 响应加 `results: SourceBatchItemResult[]`，缺失 source 标 `{ok:false, error_code:'SOURCE_NOT_FOUND'}`，保留 deleted_ids/deleted_count
- [ ] 3.3 如 shared schemas 有 batch 响应类型，更新 `packages/shared/src/schemas/source.ts`

## 4. P1: re-embed 清全部错误字段

- [ ] 4.1 单 re-embed 设 processing 时：`errorCode=null, errorMessage=null, recoveryHint=null, lastErrorAt=null`
- [ ] 4.2 batch re-embed 同样清字段

## 5. P1: ingestion 失败诊断 4-stage

- [ ] 5.1 `pipeline.ts` 拆分 embed 阶段：embedBatch 失败 → `EMBEDDING_FAILED`；insertChunkVector 失败 → `VECTOR_STORE_FAILED`
- [ ] 5.2 parse 失败 → `PARSE_ERROR`；兜底 → `INGESTION_FAILED`
- [ ] 5.3 每个失败设 `recoveryHint`（中文恢复建议）+ `lastErrorAt`（ISO timestamp）

## 6. P1: tag 缓存失效

- [ ] 6.1 tag create/update/delete 末尾调 `bumpSourcesEpoch(nid)`
- [ ] 6.2 tag bind/unbind 末尾调 `bumpSourcesEpoch(nid)`

## 7. 测试

- [ ] 7.1 `test/sources/ownership.test.ts`: 跨 notebook 访问 4 路由均返回 404
- [ ] 7.2 `test/source-connectors/dedup-gate.test.ts`: 关闭 dedup 配置时 connector 导入创建新 source（不复用）
- [ ] 7.3 `test/sources/batch-results.test.ts`: batch re-embed/delete 响应含 results 数组 + per-item 状态
- [ ] 7.4 `test/sources/reembed-clear.test.ts`: re-embed 后 source 行无残留 errorCode/recoveryHint
- [ ] 7.5 `test/sources/ingestion-diagnostics.test.ts`: 4-stage error codes + recovery_hint + last_error_at
- [ ] 7.6 `test/sources/tag-cache-invalidation.test.ts`: tag 变更后 sources epoch 递增

## 8. spec + 验证

- [ ] 8.1 `llman sdd validate c57-fix-v2-sources-safety-and-diagnostics` 通过
- [ ] 8.2 `bun test` (server) 通过
- [ ] 8.3 `bun typecheck` (server) ✅
- [ ] 8.4 `bun oxlint` 0 error
