# c28 design — analysis 恢复向量 KNN

## 问题根因

sqlite-vec 的 `vec_chunks` 虚拟表专为 KNN 查询设计（`SELECT ... FROM vec_chunks WHERE embedding MATCH ? ORDER BY distance`），但**不暴露存储的向量列本身**（无法 `SELECT embedding FROM vec_chunks`）。所以 correlation 需要两两余弦时拿不到原始向量，被迫退回关键词 TF。

## 方案二选一

### Option 1: sqlite-vec 显式向量读（推荐）

sqlite-vec 实际**支持** `SELECT vector FROM vec_chunks WHERE ...` 取原始向量（virtual table 的 row 列）。之前注释认为不支持是基于误判。

```ts
// db/vectors.ts 新增
export function getVectors(notebookId): { chunkId; vector }[] {
  return db()
    .select({ chunkId, vector: vecChunks.vector })
    .from(vecChunks)
    .where(eq(notebookId))
    .all();
}
```

- ✅ 无额外存储（复用已有 vec_chunks）
- ✅ 向量始终与 KNN 索引一致
- ⚠️ 需验证 sqlite-vec 版本的 vector 列可读性

### Option 2: 缓存 embedding 到普通列

新增 `chunks.embedding_blob BLOB` 列，embed 时同步写入。analysis 从普通列读向量。

- ✅ 普通列读取无限制
- ❌ 双写（vec_chunks + chunks.embedding_blob）一致性负担
- ❌ 存储翻倍

## 决策：Option 1

先用 Option 1（验证 sqlite-vec vector 列可读）。若版本不支持再退 Option 2。

## 改造点

- `correlation.ts`: 对每个 chunk 用 `getVectors` 拿向量 → 成对 cosine（或对每个 chunk KNN 查 top-20 邻居）
- `clustering.ts`: `getVectors` → embedding 向量做 greedy centroid（复用现有算法，仅换向量源）
- 对照 v1 `correlation.py`（KNN top_k=20, min_score=0.7, 排除同 source）

## 不做

- 不改 contradiction（已用 LLM，与向量无关）
- 不改 analysis router 的 LLM summary（v2 独占改进，保留）
