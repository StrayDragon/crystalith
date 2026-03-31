# workspace-api-contract 规范增量

## ADDED Requirements

### Requirement: Rate Limited Responses MUST Use the Unified Error Envelope and retry_after
系统 MUST 为 HTTP rate limiting 提供稳定的对外语义：返回 429，并在统一错误信封中暴露 `retry_after` 指引。

#### Scenario: Client receives 429 with retry guidance
- **WHEN** 客户端触发 rate limit
- **THEN** 系统 SHALL 返回 429
- **AND** 响应 MUST 使用统一错误信封（`error_code`, `message`, `details?`, `retry_after?`）
- **AND** 响应 MUST 包含 `retry_after`（秒）
- **AND** 响应头 SHOULD 包含 `Retry-After`（秒）

### Requirement: Health Endpoints Remain Exempt from HTTP Guardrails
系统的健康检查端点 MUST 保持可用于运维探活与诊断，不应因 guardrails 被拒绝。

#### Scenario: Health stays accessible while guardrails are enabled
- **WHEN** 运维启用 guardrails（非本地暴露或显式 enabled）
- **THEN** `/health` 与 `/health/dependencies` SHALL 仍可匿名访问
