# analysis-api Specification

## Purpose

定义 Notebook 跨文档分析的后端 API：基于向量条目生成 `topics / relations / contradictions`，供 Workspace 的 Analysis 面板与知识图谱消费。该能力为**按需计算、只读、best-effort** 的 UI 辅助信号。

## Related specs

- `GLOSSARY.md`
- `cross-document-analysis/spec.md`
- `vector-storage/spec.md`
- `workspace-analysis-ui/spec.md`

## API

- `GET /v1/notebooks/{notebook_id}/analysis` → `AnalysisResult`
  - `AnalysisResult`：
    - `topics: Topic[]`
    - `relations: Relation[]`
    - `contradictions: Relation[]`
  - `Topic` 至少包含：`id`, `name`, `chunk_ids`, `keywords`
  - `Relation` 至少包含：`source_chunk_id`, `target_chunk_id`, `relation_type`, `score`
    - `relation_type` 允许值：`similar | contradicts | references(保留)`

## Requirements

### Requirement: Notebook not found
- **WHEN** notebook 不存在
- **THEN** 返回 404

### Requirement: Empty notebook returns empty arrays
- **WHEN** notebook 尚无可用向量条目（未索引或为空）
- **THEN** 返回 `topics=[]`, `relations=[]`, `contradictions=[]`

### Requirement: Similarity relations are chunk-level and cross-source
系统 MUST 基于向量存储的 top-k 搜索抽取 chunk 级相似关系：

- MUST 避免全对暴力比较（采用 top-k）
- MUST 排除同一来源（cross-source only）
- MUST 对无序对去重（同一对只保留最高分）
- MUST 设置结果上限（防止大 notebook 产生不可用的大返回）

### Requirement: Topic clustering is bounded and explainable
系统 MUST 对向量条目进行主题聚类，并提供可解释的主题标签：

- MUST 限制主题数上限（避免碎片化主题）
- 每个 topic MUST 具备 `chunk_ids` 与 `keywords`
- `name` SHOULD 由 keywords 生成（用于 UI 展示）

### Requirement: Contradiction detection is gated and concurrency-limited
系统 MUST 对相似关系中的少量候选执行受控的矛盾检测：

- 候选来源于高分 `relation_type="similar"` 片段对（并设定候选上限）
- 判定为 LLM yes/no（不要求生成长解释）
- 并发检查数 MUST 受限（防止压垮 provider / 增大延迟）
- **WHEN** 判定矛盾
  - **THEN** contradictions 返回 `Relation(relation_type="contradicts")`
  - **AND** `score` 继承相似关系分数（用于 UI 排序/强调）

## Implementation notes（代码对齐）

- 当前实现使用：`min_score=0.7`, `top_k=20`, `max_relations=200`
- 主题聚类默认：`max_topics=10`, `max_keywords=6`
- 矛盾检测默认：`max_checks=12`, `concurrency_limit=5`
- 只读：analysis 会读取 chunks 文本用于关键词抽取与 LLM 提示构造，但不会写入 sources/outputs
