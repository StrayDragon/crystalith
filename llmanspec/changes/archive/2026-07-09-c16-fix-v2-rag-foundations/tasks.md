# fix-v2-rag-foundations — Tasks

## 1. score 语义修正 (P0)

- [x] `rag/embed-strategy.ts`: distance→similarity (`score = 1 - distance`)，过滤 `score >= minScore`，默认 0.2，topK 默认 8
- [x] `rag/hybrid-strategy.ts`: 同步 score 语义（embed 分支转 similarity 后再与 BM25 RRF）
- [x] `rag/keyword-strategy.ts` / `page-index-strategy.ts`: score 语义对齐（BM25 已是相似度，确认无反转）
- [x] `rag/types.ts`: ChunkResult 字段 `distance` → `score`（统一相似度语义，higher=better）
- [x] 消费方对齐: `features/sources/router.ts`、`features/qa/handler.ts` 改读 `.score`
- [x] 验证: `bun test test/rag/` + typecheck 通过

## 2. 分块参数对齐

- [x] `rag/chunker.ts`: 参数改 800/100，确认滑动窗口逻辑正确，导出 chunkText
- [x] `features/sources/pipeline.ts`: 接线 chunkText 替换 chunkSimple，删除 chunkSimple
- [x] 验证: `bun test test/rag/chunker.test.ts`（800/100 边界、overlap 正确）

## 3. tokenizer 修复 + context window

- [x] `ai/tokenizer.ts`: `require('gpt-tokenizer')` → 顶层 `import { encode, decode }`
- [x] 新建 `rag/context-window.ts`: token 预算优先级截断（history→retrieval→recent→system→query）
- [x] 验证: `bun test test/rag/context-window.test.ts`（超预算截断行为）

## 4. multi-query + 多样性

- [x] 新建 `rag/multi-query.ts`: buildQuerySeeds(query, outputType?) + RRF 融合多查询结果
- [x] 新建 `rag/diversity.ts`: 内容 sha256 去重 + max_chunks_per_source 上限
- [x] 接线到 EmbedStrategy retrieve()（multiQuery 选项 + chunkIds 复用路径 + maxPerSource）
- [x] 验证: `bun test test/rag/multi-query.test.ts` + `test/rag/diversity.test.ts`

## 5. EpochCache 接线

- [x] `rag/cache.ts`: 重写为 per-notebook epoch 模型（bumpSourcesEpoch/bumpVectorEpoch/getCached/setCached）
- [x] EmbedStrategy retrieve() 查/存 EpochCache；indexSource 后 bumpVectorEpoch
- [x] sources pipeline: 增源时 `bumpSourcesEpoch(notebookId)`；sources router: 删源时 bump
- [x] 验证: `bun test test/rag/cache.test.ts`（epoch 变更后缓存失效）

## 6. 整体验证

- [x] `cd apps/server && bun test tests/bdd/`（核心 CRUD 域仍 21 pass / 0 fail）
- [x] `cd apps/server && bun test test/rag/`（26 rag 单元测试全绿）
- [x] `bun oxlint`（全仓 0 error）
- [x] `bun typecheck`（server 通过）

## Verification

```bash
cd apps/server
bun test tests/bdd/          # 21 pass / 0 fail（不受影响）
bun test test/rag/           # 26 pass / 0 fail（score/chunker/context-window/multi-query/diversity/cache）
bun oxlint                   # 0 error
bun typecheck                # 通过
```
