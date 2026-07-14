# c57 Tasks

## 1. P0-A: 单 source 路由 notebook 归属校验

- [x] 1.1 `router.ts`: `GET /sources/:id` 加 `?notebook_id=` query 校验（不匹配 404）
- [x] 1.2 `DELETE /sources/:id` 同归属校验
- [x] 1.3 `POST /sources/:id/re-embed` 同归属校验
- [x] 1.4 `GET /sources/:id/chunks` 同归属校验
- [x] 1.5 采用 query-param 校验而非路径嵌套（降低前端 BREAKING，对齐 v1 隔离语义）

## 2. P0-B: connector dedup 配置门控

- [x] 2.1 `sync.ts`: `ingestConnectorEntry` 内 dedup 包裹 `if (getDedupEnabled())`
- [x] 2.2 关闭配置时跳过 dedup，总是创建新 source

## 3. P1: batch per-item results

- [x] 3.1 batch re-embed 响应加 `results` 数组（每项 `{source_id, ok, error_code?, message?}`）
- [x] 3.2 batch delete 响应加 `results` 数组（缺失 source 标 SOURCE_NOT_FOUND）+ notebook 归属校验

## 4. P1: re-embed 清全部错误字段

- [x] 4.1 单 re-embed 设 processing 时清 errorCode/errorMessage/recoveryHint/lastErrorAt
- [x] 4.2 batch re-embed 同样清字段

## 5. P1: ingestion 失败诊断

- [x] 5.1 `pipeline.ts` 4-stage 错误码（PARSE_ERROR/EMBEDDING_FAILED/VECTOR_STORE_FAILED/INGESTION_FAILED）
- [x] 5.2 每个 stage 设 recoveryHint（中文恢复建议）
- [x] 5.3 lastErrorAt 已设（c30 已有）

## 6. P1: tag 缓存失效

- [x] 6.1 tag create/update/delete 末尾调 `bumpSourcesEpoch(nid)`
- [x] 6.2 tag bind/unbind 末尾调 `bumpSourcesEpoch(nid)`

## 7. 测试

- [x] 7.1 `test/sources/c57-safety-diagnostics.test.ts`: 4-stage 错误码 + recovery hints (3 tests)

## 8. spec + 验证

- [x] 8.1 `llman sdd validate c57-fix-v2-sources-safety-and-diagnostics` 通过
- [x] 8.2 `bun test` (server) 通过（281 pass / 0 fail）
- [x] 8.3 `bun typecheck` (server) ✅
- [x] 8.4 `bun oxlint` 0 error
