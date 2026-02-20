## ADDED Requirements

### Requirement: Effective Tuning Observability
系统 SHOULD 在生成相关日志中记录 effective tuning（至少包括 top_k/min_score/agent_retries 以及与 multi-query/budget 相关的关键字段），以支持数据驱动调参回归。

#### Scenario: 日志包含 effective tuning
- **WHEN** 系统完成一次输出生成请求
- **THEN** 日志 SHOULD 包含 effective `top_k`、`min_score`、`agent_retries`
- **AND** SHOULD 包含 query_count 与关键阶段耗时（embed/search/generate 等）
