# structured-generation-retry-buckets-and-error-taxonomy 规范增量

## ADDED Requirements

### Requirement: Structured Generation Failures MUST Map to Stable Retry Buckets
系统 MUST 将结构化生成失败映射到稳定 retry buckets，而不是只留一段不可消费的错误文案。

#### Scenario: 某次生成失败
- **WHEN** typed generation request 在任一阶段失败
- **THEN** 系统 SHALL 将失败归类到稳定 bucket（如 schema、parse、model capability、context insufficiency、postprocess）
- **AND** SHALL 让后续 retry、fallback 或 repair 策略消费该分类

### Requirement: Retry Policy MUST Be Bucket-Aware Rather Than One-Size-Fits-All
系统 MUST 根据 bucket 选择不同 retry policy，而不是无差别重跑同一请求。

#### Scenario: 系统决定如何处理失败
- **WHEN** 某次失败已被分配到稳定 retry bucket
- **THEN** 系统 SHALL 使用该 bucket 对应的 retry、fallback 或 no-retry 策略
- **AND** SHALL 能解释为何选择该策略
