# fix-v2-rag-foundations — Tasks

## 1. score 语义修正 (P0)

- [ ] `rag/embed-strategy.ts`: distance→similarity (`score = 1 - distance`)，过滤 `score >= minScore`，默认 0.2，topK 默认 8
- [ ] `rag/strategies/hybrid-strategy.ts`: 同步 score 语义（embed 分支转 similarity 后再与 BM25 RRF）
- [ ] `rag/strategies/keyword-strategy.ts` / `page-index-strategy.ts`: score 语义对齐（BM25 已是相似度，确认无反转）
- [ ] 验证: `bun test test/rag/score.test.ts`（score 转换 + 过滤方向）

## 2. 分块参数对齐

- [ ] `rag/chunker.ts`: 参数改 800/100，确认滑动窗口逻辑正确，导出 chunkText
- [ ] `features/sources/pipeline.ts`: 接线 chunkText 替换 chunkSimple，删除 chunkSimple
- [ ] 验证: `bun test test/rag/chunker.test.ts`（800/100 边界、overlap 正确）

## 3. tokenizer 修复 + context window

- [ ] `ai/tokenizer.ts`: `require('gpt-tokenizer')` → 顶层 `import { encode, decode }`
- [ ] 新建 `rag/context-window.ts`: token 预算优先级截断（history→retrieval→recent→system→query）
- [ ] 验证: `bun test test/rag/context-window.test.ts`（超预算截断行为）

## 4. multi-query + 多样性

- [ ] 新建 `rag/multi-query.ts`: buildQuerySeeds(query, outputType?) + RRF 融合多查询结果
- [ ] 新建 `rag/diversity.ts`: 内容 sha256 去重 + max_chunks_per_source 上限
- [ ] 接线到各策略 retrieve()（可选启用，默认开 multi-query）
- [ ] 验证: `bun test test/rag/multi-query.test.ts`

## 5. EpochCache 接线

- [ ] `rag/cache.ts`: 各策略 retrieve() 开头查 EpochCache
- [ ] sources router: 增删改源时 `bumpSourcesEpoch(notebookId)`
- [ ] embedder: 重嵌时 `bumpVectorEpoch(notebookId)`
- [ ] 验证: `bun test test/rag/cache.test.ts`（epoch 变更后缓存失效）

## 6. 整体验证

- [ ] `cd apps/server && bun test tests/bdd/`（核心 CRUD 域仍 21 pass / 0 fail）
- [ ] `cd apps/server && bun test test/rag/`（新增检索单元测试全绿）
- [ ] `bun oxlint apps/server/src/rag/`（0 error）

## Verification

```bash
cd apps/server
bun test tests/bdd/          # 21 pass / 0 fail（不受影响）
bun test test/rag/           # 新增 score/chunker/context-window/multi-query/cache 测试全绿
bun oxlint apps/server/src/rag/  # 0 error
```
