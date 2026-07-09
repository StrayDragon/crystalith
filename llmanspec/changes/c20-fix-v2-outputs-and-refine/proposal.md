---
depends_on: [c16-fix-v2-rag-foundations, c19-add-v2-task-queue]
blocks: [c13-add-v2-distribution, c14-add-v2-cleanup-delivery]
batch: all
---

# c20-fix-v2-outputs-and-refine — 输出与精炼对齐

## Why

`docs/V1-V2-DRIFT-ANALYSIS.md` 揭示多个 outputs/refine 缺陷：(1) DB 枚举有 10 种 output 类型但只有 7 种有 generator，**PARAGRAPH/BULLETS/STRUCTURED 请求会 throw "Unknown output type"**；(2) `convert-to-source` 不 embed 新 chunk，转换后语义检索找不到；(3) refine 查询忽略 `source_ids`（只按 notebookId）；(4) refine 格式与 v1 不一致（v2 是 expand/summarize/rewrite/translate，v1 是 paragraph/bullets/structured）。

## What Changes

- **MODIFIED** `apps/server/src/features/outputs/generator.ts` — 补 PARAGRAPH/BULLETS/STRUCTURED 三种 core output 的 generator + OUTPUT_META
- **NEW** `apps/server/src/features/outputs/postprocess.ts` — 后处理：ensure_minimum_content + sanitize_citations_indices + quality repair（移植 v1 `output_postprocess.py`）
- **MODIFIED** `apps/server/src/features/outputs/router.ts` — convert-to-source 后 embed + 向量化新 chunk
- **MODIFIED** `apps/server/src/features/refine/router.ts` — 修复 source_ids 过滤 bug（当前只按 notebookId）；格式对齐 v1（paragraph/bullets/structured）
- **MODIFIED** `apps/server/src/features/refine/router.ts` — refine 经 c19 任务队列异步执行

## Capabilities

- structural-refinement-for-generated-results (spec delta: 3 core types + 后处理)
- cross-type-result-transformations (spec delta: convert-to-source embed)

## Impact

- 全 10 种 output 类型可用（不再 throw）
- output 内容质量修复（fallback/repair）
- convert-to-source 的源可被语义检索命中
- refine 正确按 source_ids 过滤，格式对齐 v1
