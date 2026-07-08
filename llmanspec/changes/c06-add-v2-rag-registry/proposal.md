---
depends_on: [c04-add-v2-core-crud, c05-add-v2-rag-embed]
batch: all
---

# c06-add-v2-rag-registry — 可插拔 RAG 策略注册表

## Why

v2 的差异化竞争力在于多策略 RAG。Embed RAG 只是起点，后续需要支持 Keyword (BM25)、Hybrid (Embed + BM25 + RRF)、Page Index、GraphRAG、HyDE、Self-RAG。统一注册表模式让每种策略实现相同接口，用户在每个 notebook 上自由切换。

## What Changes

- **NEW** `server/src/rag/registry.ts` — RAGStrategy 接口 + RAGRegistry 注册表
- **NEW** `server/src/rag/keyword-strategy.ts` — sqlite-fts5 BM25 策略
- **NEW** `server/src/rag/hybrid-strategy.ts` — Embed + BM25 + RRF 混合
- **NEW** `server/src/rag/page-index-strategy.ts` — 页面级索引策略
- **NEW** `server/src/db/schema.ts` — rag_strategies/strategy_configs/strategy_indexes 表

## Capabilities

- retrieval-and-cache (spec delta: 多策略注册表)

## Impact

- 用户可在 notebook 设置中选择 RAG 策略组合
- 新增策略只需实现 RAGStrategy 接口并 register
- 后端 /v2/strategies 端点返回可用策略列表
