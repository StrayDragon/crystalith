# update-v2-analysis-vector-strategy — Tasks

## 向量读取

- [ ] 验证 sqlite-vec vec_chunks.vector 列可读性 (Option 1 可行性)
- [ ] db/vectors.ts 新增 getVectors(notebookId) 取原始向量 (或退 Option 2 加 embedding_blob 列)

## 改造

- [ ] analysis/correlation.ts 关键词 TF → 向量 KNN/cosine
- [ ] analysis/clustering.ts 关键词 TF 向量 → embedding 向量
- [ ] 对照 v1: KNN top_k=20, min_score=0.7, 排除同 source

## 验证

- [ ] bun test 新增向量聚类/相关性测试 (语义近义用词不同场景)
- [ ] bun typecheck
