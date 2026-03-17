# generation-fallback-strategies-and-safe-degradation 规范增量

## ADDED Requirements

### Requirement: Fallback Decisions MUST Be Explicitly Authorized by the Generation Contract
系统 MUST 只在 generation type 明确允许的边界内执行 fallback，而不是把任何失败都静默替换成“差不多”的结果。

#### Scenario: 首选生成路径无法继续
- **WHEN** 某次生成因兼容性或运行时问题无法按首选路径完成
- **THEN** 系统 SHALL 仅在 generation contract 标记为 fallback-eligible 时才尝试替代路径
- **AND** SHALL 拒绝替代那些用户未授权放弃的核心能力

### Requirement: Safe Degradation MUST Explain Capability Losses and Preserved Guarantees
系统 MUST 对降级结果显式说明丢失了什么能力、保留了什么保证，而不是把降级结果伪装成正常结果。

#### Scenario: 系统返回一个降级后的结果
- **WHEN** 某次生成通过 fallback 返回了降级结果
- **THEN** 结果 SHALL 标记其 degradation state
- **AND** SHALL 说明能力损失和仍被保留的关键保证
