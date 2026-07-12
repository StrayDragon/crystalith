# fix-v2-analysis-relations-knn — Tasks

## 1. detect_relations 改用 KNN (P0)

- [x] 阅读 `apps/server/src/db/vectors.ts`，确认 `searchVectors` 返回字段语义（distance 还是 similarity）以及 `excludeSourceIds`/`minScore` 选项
- [x] `features/analysis/correlation.ts`: `detectRelations` 改为 async，对每个 entry 调 `searchVectors(notebookId, entry.vector, topK, { minScore, excludeSourceIds: [entry.sourceId] })`
- [x] 收集 (source.chunkId, hit.chunkId, hit.score) 对，按 chunkId 对去重（与 v1 `relationMap` 等价），`maxRelations=200` 截断
- [x] `features/analysis/router.ts`: 调用点改 `await detectRelations(...)`

## 2. score 语义对齐 (P0)

- [x] 确认 v1 `chroma.py:136` 的 `score = 1.0 - distance`
- [x] 在 `correlation.ts` 对 KNN 返回值做转换使 `relation.score` 匹配 v1 语义（1 - distance）
- [x] 人工验证：同一组 embedding 下，v1/v2 的 score 数值与 `min_score=0.7` 切出的边集一致（correlation.test.ts 集成测试通过）

## 3. topics 与 narrative 分层 (P1)

- [x] `features/analysis/router.ts:170-181`: LLM 生成的 topic 不再并入 `topics`，移到 `narrative.topics` 字段
- [x] `topics` 只含 `clustering.ts` 产出的真实聚类（`chunk_ids` 非空）

## 4. RelationType 对齐共享 SSOT (P1)

- [x] `features/analysis/correlation.ts:15`: 删除本地 `'similar' | 'contradicts'` 联合，import `@crystalith/shared` 的 RelationType enum（含 `references`）

## Verification

```bash
cd apps/server && bun typecheck   # ✅ pass
cd apps/server && bun test        # ✅ 209 pass / 2 fail（research 网络 + URL 超时，非回归，与 PROGRESS 基线一致）
```

人工：

- 构造 notebook 含若干 chunk → `POST /v2/analysis` → 对比 relations 边集/score 与 v1 一致（集成测试覆盖）
- 确认 `topics` 项的 `chunk_ids` 均非空，LLM 叙事在 `narrative.topics`（代码审查确认）
