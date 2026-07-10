# update-v2-analysis-vector-strategy — Tasks

## 向量读取

- [x] 验证 sqlite-vec vec_chunks.embedding 列可读性 (Option 1 确认可行 — SELECT embedding 返回 BLOB → Float32Array 精确还原)
- [x] db/vectors.ts 新增 getStoredVectors(notebookId) 取原始向量 (StoredVector{chunkId,sourceId,vector:Float32Array})

## 改造

- [x] analysis/correlation.ts 关键词 TF → 向量 cosine (pairwise, top_k=20, min_score=0.7, 排除同 source, maxRelations=200)
- [x] analysis/clustering.ts 关键词 TF 向量 → embedding 向量 greedy centroid (minSimilarity=0.7, maxTopics=10)
- [x] analysis/router.ts: 调 getStoredVectors 取向量,过滤无向量 chunk,传 VectorChunkEntry[] 给两个函数
- [x] 对照 v1: clustering.py cluster_topics + correlation.py detect_relations 默认值一致

## 验证

- [x] bun test analysis 测试全绿 (clustering+correlation 改用合成向量, 18 tests)
- [x] bun typecheck clean
- [x] bun test 全量 164 pass / 0 fail
- [x] bun test tests/bdd 21 pass 不回归
