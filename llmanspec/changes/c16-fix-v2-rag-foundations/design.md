# c16 design — 检索地基修复

## 选型与映射

### score 语义（P0 核心 bug）

| 项     | v1 (ChromaDB)              | v2 当前 (sqlite-vec)               | v2 修复后                  |
| ------ | -------------------------- | ---------------------------------- | -------------------------- |
| 返回值 | cosine distance            | distance（L2/cosine distance）     | distance                   |
| 转换   | `score = 1 - distance`     | **无转换，直接用 distance**        | `score = 1 - distance`     |
| 过滤   | `score >= min_score(0.2)`  | `distance >= minScore(0)` ❌方向反 | `score >= minScore(0.2)` ✓ |
| 排序   | score desc（相似度高在前） | distance asc（距离小在前）         | score desc                 |

sqlite-vec 的 vec0 表默认用 cosine distance（0=相同，2=相反）。`score = 1 - distance` 把它映射到 [-1,1] 相似度，与 v1 ChromaDB 语义一致。

### 分块参数对齐

v1 `chunker.py:16`: `chunk_size=800, overlap=100`，step=700，纯字符滑动窗口。
v2 `rag/chunker.ts` 当前 maxLen=500/overlap=50（死代码），`pipeline.ts` chunkSimple 500/无overlap（活代码）。

**决策**：修正 `chunker.ts` 为 800/100，接线进 pipeline，删 chunkSimple。不引入 `@langchain/textsplitters`（自写 50 行够用，避免依赖）。

### multi-query 扩展（移植 v1 `context.py:168-232`）

v1 按 output_type 生成 query seeds（如 FAQ → "常见问题"+"FAQ"+"疑问句"），`_select_query_seeds` 用 `seed_cap` 限制数量，多查询结果 RRF 融合。
v2 新建 `multi-query.ts`：`buildQuerySeeds(query, outputType?)` → string[]，每查询独立 embed+检索，RRF k=60 融合。

### token 预算截断（移植 v1 `window.py`）

v1 `ContextWindow.build`: 按 max_tokens 预算优先级截断（history→retrieval→recent→system→query），超预算截断或压缩。
v2 新建 `context-window.ts`，基于修复后的 `tokenizer.ts`（gpt-tokenizer）。

### EpochCache 接线

v2 `rag/cache.ts` 的 EpochCache 类已存在但零调用。接线点：

- 各策略 retrieve() 开头查缓存（key = query+notebookId+epoch+params）
- 源增删改时（sources router）调 `bumpSourcesEpoch(notebookId)`
- 向量重嵌时调 `bumpVectorEpoch(notebookId)`

## 关键接口

```ts
// embed-strategy.ts — 修正后
async retrieve(query, notebookId, opts?: { topK?: number; minScore?: number }): Promise<ChunkResult[]> {
  const hits = searchVectors(db(), queryVec, notebookId, opts?.topK ?? 8);
  return hits
    .map(h => ({ ...h, score: 1 - h.distance }))  // distance → similarity
    .filter(h => h.score >= (opts?.minScore ?? 0.2))
    .sort((a, b) => b.score - a.score);
}

// chunker.ts — 修正后（v1 对齐）
export function chunkText(text: string, maxLen = 800, overlap = 100): ChunkPayload[]

// context-window.ts — 新建
export function buildContext(parts: ContextPart[], maxTokens: number): string
```

## 验证

- 现有 BDD `tests/bdd` 全绿（核心 CRUD 域不依赖检索，不受影响）
- 新增 `apps/server/test/rag/` 单元测试：score 转换、chunker 边界、multi-query 融合、token 截断、epoch 失效
