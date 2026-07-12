# c47-fix-v2-analysis-relations-knn — Design

## 决策

### D1: detect_relations 改用 searchVectors 而非内存 pairwise

v2 已有 `searchVectors(notebookId, queryVector, topK, opts)`（`db/vectors.ts:79-104`），内部走 sqlite-vec 的 `MATCH ... ORDER BY distance`。RAG 的 embed-strategy 和 research 的 retrieve-sources 工具都在用。analysis 路由 (`router.ts:106`) 当前调 `detectRelations(entries, notebookId)`（纯内存），改为：

```ts
// 对每个 entry 调一次 KNN，与 v1 correlation.py:30-36 对齐
for (const entry of entries) {
  const hits = await searchVectors(notebookId, entry.vector, topK, {
    minScore,
    excludeSourceIds: [entry.sourceId],
  });
  // 收集 (entry.chunkId, hit.chunkId, hit.score) 对，去重
}
```

**为什么不保留 "equivalent" 的 pairwise**：`correlation.ts:8-10` 的 "equivalent for desktop-scale" 假设两点不成立——(1) tie-breaking 顺序不同产不同边集；(2) v1 的 score 是 `1 - distance`，sqlite-vec 与 chroma 的距离度量实现差异会引入系统性偏差。复用 `searchVectors` 直接消解这两个问题，且与 v1 算法 1:1 对齐。

### D2: score = 1 - distance（对齐 v1 `chroma.py:136`）

`searchVectors` 当前返回的 score 语义需确认。`db/vectors.ts` 返回的字段若为 `distance`，转换 `score = 1 - distance`；若已返回 similarity，则保持。**实现前 SHALL 先读 `db/vectors.ts` 确认返回字段语义**，并在 `correlation.ts` 里做一次转换使最终 `relation.score` 与 v1 数值可比。

### D3: topics 与 narrative 分层

`router.ts:170-181` 当前把 LLM topic 并入 `topics`（chunk_ids:[]）。改为：

- `topics` 只含真实聚类（`clustering.ts` 产出，chunk_ids 非空）。
- LLM 叙事/总结的"高层 topic"放 `narrative.topics`（或维持现状只放 `narrative.summary`）。

无 BREAKING：顶层 `narrative` 字段已存在（`router.ts:195`），消费方已读它。

### D4: RelationType 引用共享 SSOT

`correlation.ts:12-17` 本地声明 `relationType: 'similar' | 'contradicts'`。改为 import `packages/shared/src/schemas/analysis.ts` 的 enum，避免本地窄化。当前无代码产出 `references`，故仅类型对齐，不引入新产出路径。

## 迁移与回滚

- 纯算法替换，无 DB schema 变更、无 API 契约变更。
- 回滚 = 还原 `correlation.ts` 到内存 pairwise 版本（git revert）。

## 验证

```bash
cd apps/server && bun typecheck
cd apps/server && bun test   # analysis 相关测试
```

人工对比：构造一个含若干 chunk 的 notebook，对比改前/改后 `POST /v2/analysis` 返回的 relations 边集与 score，确认与 v1 行为（同一组 embedding）一致。
