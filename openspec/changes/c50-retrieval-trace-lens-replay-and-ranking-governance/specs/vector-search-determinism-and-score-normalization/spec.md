# vector-search-determinism-and-score-normalization 规范增量

## ADDED Requirements

### Requirement: Vector Scores MUST Normalize to a Stable Similarity Semantics
系统 MUST 将 provider 原始分数归一到稳定的 `similarity_score` 语义，而不是让调用方自己猜测 distance 或 similarity 的方向与范围。

#### Scenario: 系统消费不同 provider 的向量检索结果
- **WHEN** 检索结果来自不同向量 provider 或不同内部分数语义
- **THEN** 系统 SHALL 统一暴露可比较的 `similarity_score`
- **AND** 下游的 `min_score`、排序与调试解释 SHALL 基于该统一语义

### Requirement: Result Ordering MUST Use Stable Tie-breakers and Determinism Notes
系统 MUST 为近分/同分结果定义稳定排序与 determinism notes，而不是放任 provider 返回顺序抖动。

#### Scenario: 多个结果分数接近或 provider 顺序不稳定
- **WHEN** 检索结果出现近分、同分或 ANN 波动风险
- **THEN** 系统 SHALL 应用稳定 tie-break 规则
- **AND** SHALL 在 trace 中记录必要的 determinism notes 以解释潜在波动来源
