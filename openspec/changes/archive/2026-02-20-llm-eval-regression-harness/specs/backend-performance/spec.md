## ADDED Requirements

### Requirement: Timings are Exportable for Evaluation
系统 SHOULD 以稳定字段名提供分阶段 timings（embed/search/db/format/generate/total 等）与 query_count，供评测工具与性能回归使用。

#### Scenario: 评测工具可读取 timings
- **GIVEN** 一次生成请求的结果与日志/返回结构
- **WHEN** 评测工具收集指标
- **THEN** 工具 SHOULD 能读取 query_count 与关键阶段耗时字段并纳入报告
