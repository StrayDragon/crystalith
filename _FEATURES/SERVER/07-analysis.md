# 分析（Analysis）

笔记本级主题聚类、关系与矛盾检测。

---

### `analysis-run`

- **Domain:** analysis
- **Route:** `POST /v2/analysis`
- **说明:** 对笔记本执行四阶段分析：聚类 → 关系 → 矛盾 → LLM 摘要；返回 topics/relations/contradictions + narrative
- **用户可见:** Partial（`KnowledgeGraphView`）
- **代码:** `apps/server/src/features/analysis/router.ts`、`clustering.ts`、`correlation.ts`、`contradiction.ts`

> NOTE: 待盘点
