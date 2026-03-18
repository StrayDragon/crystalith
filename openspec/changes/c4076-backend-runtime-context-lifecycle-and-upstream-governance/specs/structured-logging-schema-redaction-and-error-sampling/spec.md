# structured-logging-schema-redaction-and-error-sampling 规范增量

## ADDED Requirements

### Requirement: Backend Logs MUST Follow a Structured Schema with Stable Context Keys
系统 MUST 让后端日志使用统一的结构化 schema，并稳定包含 correlation 与关键上下文字段。

#### Scenario: 系统写入一次结构化日志
- **WHEN** 后端记录 HTTP、task、SSE 或 upstream 相关日志
- **THEN** 日志 SHALL 使用统一字段名表示 `correlation_id` 与常用上下文维度
- **AND** 相同类型事件 SHALL 避免各自发明不同字段名

### Requirement: Logging MUST Enforce Redaction and Conservative Sampling
系统 MUST 对敏感字段实施脱敏，并仅对明确的噪音错误做保守采样。

#### Scenario: 记录一次错误日志
- **WHEN** 系统记录包含请求、上游调用或任务上下文的错误
- **THEN** token、cookie、原始长文本或等价敏感内容 SHALL 不被直接写入日志
- **AND** 仅明确可预期的重复噪音错误 MAY 被采样
- **AND** 首次出现或高风险错误 SHALL 仍完整保留关键线索
