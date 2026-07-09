---
depends_on: []
blocks:
  [
    c17-fix-v2-qa-citations,
    c18-add-v2-source-dedup-and-safety,
    c20-fix-v2-outputs-and-refine,
    c22-add-v2-research-agent,
    c23-fix-v2-studio-and-analysis,
    c13-add-v2-distribution,
    c14-add-v2-cleanup-delivery,
  ]
batch: all
---

# c16-fix-v2-rag-foundations — 检索地基修复

## Why

`docs/V1-V2-DRIFT-ANALYSIS.md` P0-3 揭示：v2 的 EmbedStrategy 把 sqlite-vec 返回的 `distance`（距离，越小越好）直接当分数比 `>= minScore`，默认 `minScore=0` 导致**完全不过滤**——检索地基错误，污染所有依赖检索的域（QA/outputs/refine/analysis）。

同时 `retrieval-and-cache` spec 早已声明 multi-query、token budget、epoch 缓存、assembly 缓存 4 项要求，但 v2 代码**零实现**（EpochCache 是死代码，chunker 是死代码，tokenizer 是死代码）。这是 v1→v2 迁移最大的"声明 vs 实现"鸿沟。

本 change 修对地基，是 c17/c18/c20/c22/c23 的共同前置依赖。

## What Changes

- **MODIFIED** `apps/server/src/rag/embed-strategy.ts` — distance→similarity 转换 (`score = 1 - distance`)，过滤改 `score >= minScore`，默认 `minScore=0.2`，`topK` 默认 8（对齐 v1）
- **MODIFIED** `apps/server/src/rag/strategies/{hybrid,keyword,page-index}-strategy.ts` — 同步 score 语义修正
- **MODIFIED** `apps/server/src/features/sources/pipeline.ts` — 接线 `rag/chunker.ts`（800 字符/100 overlap 滑动窗口）替换 `chunkSimple`（500/无overlap）；删除 chunkSimple
- **MODIFIED** `apps/server/src/rag/chunker.ts` — 修正参数为 v1 的 800/100，导出供 pipeline 使用（不再死代码）
- **NEW** `apps/server/src/rag/multi-query.ts` — query seed 扩展（按 output_type 生成多查询），RRF 融合
- **NEW** `apps/server/src/rag/diversity.ts` — 去重（内容 sha256）+ 每源 `max_chunks_per_source` 上限
- **MODIFIED** `apps/server/src/ai/tokenizer.ts` — 修 `require('gpt-tokenizer')` → 顶层 `import`（ESM 兼容）
- **NEW** `apps/server/src/rag/context-window.ts` — token 预算截断（移植 v1 `window.py` 优先级截断：history→retrieval→recent→system→query）
- **MODIFIED** `apps/server/src/rag/cache.ts` — EpochCache 接线到各策略 + `bumpVectorEpoch`/`bumpSourcesEpoch` 钩子（源增删改时调用）

## Capabilities

- retrieval-and-cache (spec delta: 强化 score 语义 + 接线已声明但未实现的能力)

## Impact

- **BREAKING 内部**: chunk 边界从 500/无overlap → 800/100，已有向量需重嵌入（提供 re-embed 脚本）
- min_score 默认从 0 → 0.2，低相关结果被过滤（召回略降，精度提升）
- 检索质量对齐 v1，为 c17 (QA 引用) 提供正确的相似度数据
