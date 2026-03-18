# retrieval-context-assembly-cache-and-metrics 规范增量

## ADDED Requirements

### Requirement: Retrieval Assembly Cache MUST Expose Stable Status and Dependency Semantics
系统 MUST 让 retrieval assembly cache 暴露稳定的 `cache_status` 与依赖语义，而不是只作为不可见实现细节存在。

#### Scenario: 某次 context assembly 使用缓存
- **WHEN** 检索装配链路命中、绕过或返回陈旧缓存
- **THEN** 系统 SHALL 产出稳定的 `cache_status`
- **AND** SHALL 解释导致该状态的关键依赖或 staleness 原因

### Requirement: Assembly Cache Metrics MUST Quantify Benefit and Failure Modes
系统 MUST 为装配缓存提供命中收益与失败模式度量，而不是只统计 hit/miss。

#### Scenario: 运维或调试视图查看缓存效果
- **WHEN** 系统汇总 retrieval assembly cache telemetry
- **THEN** SHALL 能反映命中率、绕过原因、节省时延或等价关键指标
- **AND** SHALL 能区分“没命中”和“不能缓存”
