## ADDED Requirements

### Requirement: Retry Strategy for External Services
系统 SHALL 对所有外部服务调用（AI provider、embedding provider、web extractor）提供统一的重试策略。重试 MUST 采用 exponential backoff，并支持配置最大重试次数和可重试异常类型。

#### Scenario: AI Provider 暂时不可用
- **WHEN** AI provider 返回 503 / 网络超时
- **THEN** 系统自动重试（最多 3 次，间隔递增），全部失败后返回标准化错误响应

#### Scenario: 速率限制重试
- **WHEN** AI provider 返回 429 Rate Limit 并包含 retry-after header
- **THEN** 系统按 retry-after 指定的时间等待后重试

### Requirement: Standardized Error Response
系统 SHALL 返回标准化的错误响应格式，包含 error_code、message、details 和可选的 retry_after 字段。

#### Scenario: 标准化错误响应
- **WHEN** API 请求触发错误
- **THEN** 响应体包含 error_code（机器可读）、message（人类可读）和 details（调试信息）
