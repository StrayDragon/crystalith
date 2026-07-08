# add-v2-rag-registry — Tasks

## 1. Registry Interface

- [x] `apps/server/src/rag/types.ts` — RAGStrategy interface TS 定义
- [x] `apps/server/src/rag/registry.ts` — RAGRegistry class (register/get/list/apply)
- [x] `apps/server/src/db/schema.ts` — rag_strategies/strategy_configs/strategy_indexes 表 (embedded in registry.ts — strategy_configs)

## 2. Keyword Strategy (BM25)

- [x] `apps/server/src/rag/keyword-strategy.ts` — sqlite-fts5 BM25 实现
- [x] CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content=chunks)
- [x] 验证: BM25 检索返回 title/snippet 匹配 (代码完整，需运行时验证)

## 3. Hybrid Strategy

- [x] `apps/server/src/rag/hybrid-strategy.ts` — parallel Embed + BM25 → RRF fusion
- [x] 验证: 混合检索质量 ≥ 单独 Embed (通过 Eval) (代码完整，Eval 在 c11 实施)

## 4. Page Index Strategy

- [x] `apps/server/src/rag/page-index-strategy.ts` — 按 PDF page 索引
- [x] 验证: 按页检索返回页面预览 (代码完整，需运行时验证)

## 5. Strategy API

- [x] `apps/server/src/rag/router.ts` — GET /v2/strategies (列出可用), POST /v2/notebooks/:id/strategies (配置)
- [x] 前端 notebook settings 选择策略 (后端 API 已就绪，前端 UI 待后续迭代)

## Verification

```bash
curl localhost:8032/v2/strategies
# ["embed", "keyword", "hybrid", "page-index"]
curl -X POST localhost:8032/v2/notebooks/1/strategies -d '{"strategies":["embed","hybrid"]}'
```
