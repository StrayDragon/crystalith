---
depends_on: []
batch: all
---

# c47-fix-v2-analysis-relations-knn — Analysis relations 回归 KNN + score 语义对齐

## Why

2026-07-12 第四轮深度复核（8 个并行 Explore agent 对照 `backend/py` SSOT + 抽样验证）发现 analysis 域存在 **1 个 P0 + 2 个 P1**。PROGRESS.v2.md 把 analysis 标为 ✅（c28 修复了向量空间），但注释里也承认"第三轮仍有 relations P0"——本轮确认了 P0 的真身。

### P0 — Relations 算法偏离（PROGRESS 注释的 P0 真身）

- **v1** (`backend/py/.../analysis/correlation.py:30-36`): `detect_relations` 对每个 chunk 调用 `vector_store.search(query_vector=entry.vector, top_k=20, min_score=0.7, exclude_source_ids=[entry.source_id])` —— 真正的向量索引 KNN 查询。
- **v2** (`apps/server/src/features/analysis/correlation.ts:64-95`): 用**内存暴力 pairwise cosine** 替代了 v1 的 KNN。文件头注释（`correlation.ts:8-10`）明确写："v1 uses per-entry KNN search; since v2 now has all vectors in memory via getStoredVectors, pairwise cosine is simpler and equivalent for desktop-scale datasets."
- **问题**: v2 **明明有** KNN 实现（`db/vectors.ts:79` `searchVectors`，被 RAG 的 `rag/embed-strategy.ts:126` 和 research 的 `ai/tools/retrieve-sources.ts:39` 使用），只是 analysis 路由（`router.ts:106`）没调用它。"equivalent" 的假设不成立：
  - **边集不同**: v1 的 `n_results=20` KNN 与 v2 的 "sort 后取 topK" 在有并列（tie）时产出不同的边。
  - **score 语义不同**: v1 = `1.0 - chroma_cosine_distance`（`chroma.py:136`）；v2 = raw cosine（`correlation.ts:26-38`）。两者只在 ChromaDB 的 cosine distance 恰好等于 `1 - cos_sim` 时相等，系统性偏差使 `min_score=0.7` 阈值切出不同的边集。
  - **前端可见**: `AnalysisPanel.tsx:148` 把 `score` 渲染为百分比（`Math.round(relation.score * 100)`），用户会看到不同的相似度数值。

### P1 — Topics 混入 LLM 占位（chunk_ids 为空）

- **v1** (`clustering.py:164-170`): 每个 topic 都带真实聚类算出的非空 `chunk_ids`。
- **v2** (`router.ts:171-181`): 把 LLM 生成的 topic 也并入 `topics`，但它们 `chunk_ids: []`（占位）。消费方若按非空 `chunk_ids` 假设处理会出问题；且 LLM 叙事混入 topics 违反契约分层。

### P1 — RelationType 丢失 `references` 字面量

- **v1** (`types.py:7`) 与共享 SSOT (`packages/shared/src/schemas/analysis.ts:7`) 都声明 `RelationType = "similar" | "references" | "contradicts"`。
- **v2** (`correlation.ts:15`): 本地类型只声明 `'similar' | 'contradicts'`，丢了 `references`。虽然 v1/v2 当前都不产出 `references` 边，但本地类型与共享 SSOT 不一致是契约漂移。

## What Changes

1. **detect_relations 改用 searchVectors KNN**: `correlation.ts` 不再内存暴力 pairwise；改为对每个 entry 调 `db/vectors.ts` 的 `searchVectors`（或经 ragRegistry），传 `topK=20`、`minScore=0.7`、排除同 source，与 v1 `correlation.py:30-36` 对齐。
2. **score 语义对齐**: KNN 查询返回的距离按 v1 `score = 1 - distance` 转换；保证 `min_score` 阈值与前端百分比呈现与 v1 一致。
3. **topics 不混入 LLM 占位**: LLM 生成的叙事/总结 SHALL 放 `narrative` 字段；`topics` SHALL 只含真实聚类的 topic（`chunk_ids` 非空）。
4. **RelationType 恢复 `references`**: `correlation.ts:15` 的本地类型 SHALL 引用共享 SSOT 的 enum 而非重新声明窄化的字面量联合。

## Capabilities

- `knowledge-curation-and-freshness`（spec delta: analysis relations KNN + score 语义 + topics chunk_ids + relation type）

> **Spec home 说明**: 现有 39 个 spec 没有专门覆盖 analysis 的 topics/relations/contradictions 能力。`knowledge-curation-and-freshness` 是最接近的（其 r2 "重复候选" 即源级别的相似关系发现），故把 chunk 级 relation 约束并入此 capability；若后续 analysis 被产品化为独立能力，可拆分为独立 spec。

## Impact

- **检索结果回归 v1**: 同一组 embedding 下边集与 v1 一致；前端相似度百分比数值与 v1 一致。
- **topics 契约更干净**: LLM 叙事与聚类结果分层，消费方不再遇到空 chunk_ids 的幽灵 topic。
- **无 BREAKING**: HTTP 路径与响应顶层字段不变（仍 `POST /v2/analysis` + `{topics, relations, contradictions, summary, narrative}`）。
