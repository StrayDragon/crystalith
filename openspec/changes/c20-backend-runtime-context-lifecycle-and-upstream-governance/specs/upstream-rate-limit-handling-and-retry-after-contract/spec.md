# upstream-rate-limit-handling-and-retry-after-contract 规范增量

## ADDED Requirements

### Requirement: Rate Limit Responses MUST Use a Unified Retry Contract
系统 MUST 将 upstream rate limit、本地 budget pressure 或等价等待场景映射到统一的 `retry_after` contract。

#### Scenario: 上游返回 429 或本地预算触发等待
- **WHEN** 某个请求因上游 429 或本地并发预算而无法立即继续
- **THEN** 系统 SHALL 使用统一错误分类表达 rate limited 状态
- **AND** SHALL 暴露稳定的 `retry_after` 语义给调用方

### Requirement: Retry Guidance MUST Propagate Consistently Across HTTP and Streams
系统 MUST 让 `retry_after` 与退避建议在普通 HTTP 与流式响应里保持一致，而不是只在某一条链路可见。

#### Scenario: 流式请求中途遇到限流
- **WHEN** SSE 或等价流式请求在处理中遇到 rate limit
- **THEN** 系统 SHALL 通过标准化 error event 传递 `retry_after`
- **AND** 普通 HTTP 响应 SHALL 同步提供等价的重试语义
