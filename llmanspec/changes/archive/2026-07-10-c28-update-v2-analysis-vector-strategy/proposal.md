---
depends_on: [c23-fix-v2-studio-and-analysis]
blocks: []
batch: all
---

# c28-update-v2-analysis-vector-strategy — analysis 恢复向量 KNN

## Why

GAP-REPORT 发现 4（🟡 静默降级）：v2 analysis 的 clustering/correlation 从 v1 的**向量 KNN** 降级为**关键词 TF 向量**。

代码注释坦诚承认（`clustering.ts:1-9`, `correlation.ts:7-10,52-65`）：sqlite-vec 虚拟表不通过 SELECT 暴露存储向量，故退而求其次用关键词空间。

影响：用户期望 v1 质量的**语义**聚类，实际得到**词袋**聚类。语义近义但用词不同的内容聚类/相关性质量显著退化。

本 change 恢复向量 KNN（需解决 sqlite-vec 向量读方案）。

## What Changes

- **MODIFIED** `features/analysis/correlation.ts`: `keywordCosineSimilarity` (O(n²)) → `vectorStore.search` KNN(top_k=20, min_score=0.7)
- **MODIFIED** `features/analysis/clustering.ts`: 关键词 TF 向量 → embedding 向量做 greedy centroid 聚类
- **NEW** 向量读取方案（见 design.md 二选一）
- 对照 v1 `features/analysis/{correlation,clustering}.py`

## Capabilities

- data-and-storage

## Impact

- 修改 2 个 analysis 文件
- 需新增向量读取能力（design.md 决策）
- 质量回归修复（P3）
