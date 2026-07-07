---
depends_on: [c01-add-v2-data-layer]
batch: all
---
# c05-add-v2-rag-embed — Embed RAG 策略 (sqlite-vec)

## Why

RAG 是 Crystalith 的核心差异化能力。v2 的首个策略是 Embed RAG：用户提问 → embedding → sqlite-vec 向量检索 → 返回相关 chunk → 拼入 prompt 作为上下文。sqlite-vec benchmark 实测：10k chunk 8ms、50k 40ms、100k 80ms（按 notebook_id partition 过滤后 30ms）。暴力扫描在个人规模 (< 10 万 chunk) 完全可用。。

## What Changes

- **NEW** `server/src/rag/embed-strategy.ts` — Embed RAG 策略实现 (index + retrieve)
- **NEW** `server/src/rag/chunker.ts` — 文本分块 (paragraph-based, ~500 chars)
- **NEW** `server/src/rag/embedder.ts` — 文本 embedding 生成 (调用 AI SDK provider)
- **MODIFIED** `server/src/db/vectors.ts` — vec_chunks 虚拟表的 INSERT/KNN 查询

## Capabilities

- retrieval-and-cache (spec delta: Embed RAG 作为首个可插拔策略)
- source-ingestion-core (spec delta: ingestion 后自动触发 embedding + 索引)

## Impact

- Embedding 模型通过 config 选择 (默认 bge-m3 1024-dim)
- 向量与 chunk 同库 (sqlite-vec + chunks 表 JOIN)
- 后续策略 (BM25/Hybrid/PageIndex) 在 c06-add-v2-rag-registry 中实现
