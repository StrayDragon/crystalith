# quality-gates-for-generation 规范增量

## ADDED Requirements

### Requirement: 生成结果必须具备质量门状态
系统 MUST 为生成结果提供可消费的质量门状态，而不是只暴露“是否生成成功”。

#### Scenario: 结果生成完成后附带质量状态
- **WHEN** 一个生成结果进入完成态
- **THEN** 系统 SHALL 为其附带质量门状态
- **AND** 该状态 SHALL 至少能区分通过、警告与阻断

### Requirement: 质量门必须返回结构化原因
系统 MUST 为质量门结果返回结构化原因，以支持解释、展示和后续治理。

#### Scenario: 结果触发质量告警
- **WHEN** 某个生成结果触发质量门
- **THEN** 系统 SHALL 返回结构化原因
- **AND** 结构化原因 SHALL 包含触发维度、触发原因与建议动作摘要

### Requirement: 质量门必须可跨生成类型复用
系统 MUST 将质量门定义为可复用能力，而不是某个结果类型的私有规则。

#### Scenario: 不同生成类型接入同一质量门能力
- **WHEN** 两类不同的生成类型都需要最小质量判断
- **THEN** 系统 SHALL 允许它们消费同一套质量门模型
- **AND** SHALL 通过类型配置决定适用门槛，而不是复制规则体系
