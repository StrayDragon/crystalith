# fix-v2-sync-embedding-before-ready — Tasks

- [x] 修改 apps/server/src/features/sources/pipeline.ts: triggerEmbedding 改为同步 await（在 status=ready 更新之前）；embedding 失败 catch 设 failed(stage 区分 PARSE_ERROR/EMBEDDING_FAILED)
- [x] 修改 apps/server/src/features/tasks/worker.ts handleDocumentParse: 交换 step 6/7（先 embed 再 mark ready）；embedding 失败设 failed
- [x] apps/server/test/sources/ingest.test.ts: stubEmbedding noop 下 ingest 仍返回 ready（同步语义兼容）
- [x] 新增 apps/server/test/sources/embed-timing.test.ts: indexSource 完成后才 ready + embedding 抛错设 failed
- [x] cd apps/server 执行 bun test 全量绿(164 pass)
- [x] cd apps/server 执行 bun typecheck clean
- [x] cd apps/server 执行 bun test tests/bdd 21 pass 不回归

## 前置条件

c24(WS-A storage + worker document_parse + server.ts dispatch notebookId) 已完成。

## 对照 v1 参考

- backend/py/src/crystalith/features/sources/api_ingest.py:809-887 — upload_source（同步 embed → vector_store.add → return）
- backend/py/src/crystalith/features/sources/api_ingest.py:611-689 — create_source_from_url（同结构）

## Verification

```bash
cd apps/server
bun test
bun test test/sources/
bun typecheck
```
