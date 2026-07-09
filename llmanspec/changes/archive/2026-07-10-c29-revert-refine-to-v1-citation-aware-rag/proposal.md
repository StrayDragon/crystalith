depends_on: [c16-fix-v2-rag-foundations, c24-add-v2-pipeline-integration]
blocks: []
batch: all
---

# c29-revert-refine-to-v1-citation-aware-rag — refine 回退为 citation-aware RAG 摘要器

## Why

全面复核（2026-07-10）发现 refine 是 **偏移最大的功能域**（GAP-BOARD G1，🔴 换产品）：

- **v1**（`backend/py/.../refine/api.py` + `tasks/worker.py:_execute_refine`）是 **citation-aware RAG 摘要器**：接收 `prompt` + `source_ids` → embed prompt → 向量检索 top-k（按 source_ids 过滤、min_score）→ 构建 citations + context → LLM 按格式（paragraph/bullets/structured）生成摘要 → 返回 `{format, paragraph|bullets|structured, citations, evidence, created_at}`。
- **v2**（`apps/server/.../refine/router.ts` + `tasks/worker.ts:handleRefine`）偏移为 **纯文本变换器**：接收 `text`（或拼接 source_ids 的全量 chunk 文本）→ 无检索 → 无 citations → expand/summarize/rewrite/translate/structured 五种文本变换 → 返回 `{mode, original_length, refined_length, text}`。

v2 不是 v1 的重写，是**不同产品**。本 change 将 v2 refine **回退对齐 v1 行为契约**。

注：`packages/shared/src/schemas/refine.ts` 的 `RefineModeSchema` 已是 v1 对齐的 `['paragraph','bullets','structured']`，且 `RefineRequest` 已含 `prompt`+`source_ids`——**schema 层未偏移，偏移在 router + worker**。

## What Changes

- **MODIFIED** `apps/server/src/features/refine/router.ts`：请求体改用 v1 契约（`prompt` + `source_ids` + `format` + `top_k` + `min_score`），删除 expand/summarize/rewrite/translate 模式逻辑；新增 `POST /v2/refine/batch` 端点（多格式并发，共享检索上下文+citations）
- **MODIFIED** `apps/server/src/features/tasks/worker.ts`：`handleRefine` 重写为 v1 `_execute_refine` 对齐流程（embed prompt → RAG registry 检索 → citations → context → LLM 生成 → `_apply_format`）；删除文本变换逻辑
- **MODIFIED** `apps/server/src/features/refine/router.ts`：`GET /v2/refine/modes` 改为返回 paragraph/bullets/structured
- **MODIFIED** `packages/shared/src/schemas/refine.ts`：`RefineResultSchema` 补 v1 响应形状（`format` / `paragraph` / `bullets` / `structured{title,bullets,terms,citations}` / `citations` / `evidence`）；新增 `RefineBatchRequestSchema` + `RefineBatchResponseSchema`

## Capabilities

- `structural-refinement-for-generated-results` — refine 回到"基于已有结果上下文的局部改良"，检索 + citations 对齐 r2（局部 refinement 基于结果上下文）

## Impact

- **BREAKING**（后端 API）：`POST /v2/refine` 请求体 `{text, mode}` → `{prompt, source_ids, format, top_k, min_score}`；响应 `{mode, original_length, refined_length, text}` → `{format, paragraph|bullets|structured, citations, evidence, created_at}`
- **BREAKING**：`GET /v2/refine/modes` 返回集 `expand/summarize/rewrite/translate/structured` → `paragraph/bullets/structured`
- 前端 refine（`useRefine.ts`）当前打 /v1 已 404，本 change 不影响前端可用性（前端迁移在 c35）
- c24 WS-C 的 `test/refine/queue.test.ts` 需更新请求/响应形状
