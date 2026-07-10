depends_on: [c24-add-v2-pipeline-integration]
blocks: []
batch: all
---

# c30-fix-v2-sync-embedding-before-ready — 同步 embedding:ready 前向量必须写入

## Why

全面复核（GAP-BOARD G3，🔴 数据竞态）：v2 source 标记 `status='ready'` **在向量写入之前**（fire-and-forget embedding），导致 QA/refine 检索竞态——source 显示 ready 但 `vec_chunks` 表无向量，检索返回空。

v1（`backend/py/.../sources/api_ingest.py:809-887`）整个 ingest handler 是 `await` 的：parse → chunk → embed → **vector_store.add** → return 201。虽然 v1 也是先 `status=READY` 再 `vector_store.add`，但整个序列在 HTTP 响应前完成，且检索有 status gate（`context.py:394` `if source.status != READY: continue`）。

**两个调用点都有此 bug：**

1. `apps/server/src/features/sources/pipeline.ts:142-146` — `triggerEmbedding(...)` fire-and-forget（`.catch()` 吞掉 promise，不 await）
2. `apps/server/src/features/tasks/worker.ts:191-210` — `handleDocumentParse` 先 mark ready（:191）再 embed（:198），中间窗口 source ready 但零向量

## What Changes

- **MODIFIED** `apps/server/src/features/sources/pipeline.ts`：`triggerEmbedding` 改为同步 `await`（在 `status='ready'` 更新**之前**）；embedding 失败时设 `status='failed'` + errorCode/errorMessage（复用现有 catch 块模式）
- **MODIFIED** `apps/server/src/features/tasks/worker.ts`：`handleDocumentParse` 交换 step 6/7——先 embed 再 mark ready；embedding 失败设 failed
- 删除 `pipeline.ts` 的 `triggerEmbedding` fire-and-forget helper（内联为同步调用）

## Capabilities

- `source-ingestion-core` — r2 "Ready source guarantees retrievability" 当前已有，本 change 是修正实现使其真正满足该不变量

## Impact

- 上传延迟增加（含 embedding 时间，与 v1 一致；bge-m3 batch-32 通常数百 ms 至数秒）
- 无 schema 变更（status enum 不变：processing/ready/failed）
- 无 breaking API 变更（响应形状不变，只是 ready 状态更晚返回）
