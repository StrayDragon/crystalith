# http-runtime-guardrails 规范增量

## ADDED Requirements

### Requirement: HTTP Guardrails MUST Be Configurable and Default to Auto for Non-Local Exposure
系统 MUST 提供可配置的 HTTP guardrails，并支持 `mode=auto|enabled|disabled`。

- `auto`：仅在后端对非 loopback 地址暴露时启用 guardrails。
- `enabled`：无条件启用 guardrails。
- `disabled`：无条件禁用 guardrails。

#### Scenario: auto mode disables guardrails for loopback bind
- **WHEN** `mode=auto`
- **AND** 后端 listen host 为 loopback（例如 `127.0.0.1`/`localhost`/`::1`）
- **THEN** 系统 SHALL 视为本地开发场景并禁用 guardrails

#### Scenario: auto mode enables guardrails for non-loopback bind
- **WHEN** `mode=auto`
- **AND** 后端 listen host 为非 loopback（例如 `0.0.0.0` 或具体非本地 IP）
- **THEN** 系统 SHALL 启用 guardrails

#### Scenario: enabled overrides auto
- **WHEN** `mode=enabled`
- **THEN** 系统 SHALL 启用 guardrails

#### Scenario: disabled overrides auto
- **WHEN** `mode=disabled`
- **THEN** 系统 SHALL 禁用 guardrails

### Requirement: Upload Requests MUST Enforce a Bounded Read Limit When Guardrails Are Enabled
当 guardrails 启用时，上传类请求 MUST 施加 `upload_max_bytes` 上限；超过上限 MUST 返回 413，且该错误 MUST 被视为确定性输入错误（不产生任何来源持久化副作用）。

#### Scenario: Oversized upload is rejected without creating a Source row
- **WHEN** guardrails 启用
- **AND** 用户上传的文件大小超过 `upload_max_bytes`
- **THEN** 系统 SHALL 返回 413
- **AND** 响应 MUST 使用统一错误信封
- **AND** `error_code` MUST 为 `PAYLOAD_TOO_LARGE`
- **AND** `details.max_bytes` MUST 等于当前配置的 `upload_max_bytes`
- **AND** 系统 SHALL 不创建 Source 记录

### Requirement: HTTP Rate Limiting MUST Return 429 with retry_after When Guardrails Are Enabled
当 guardrails 启用时，系统 MUST 对核心 API surface（例如 `/v1/**`）提供基础 rate limiting；触发时 MUST 返回 429 且暴露稳定的 `retry_after` 指引。

#### Scenario: Client exceeds rate limit
- **WHEN** guardrails 启用
- **AND** 某个客户端在一个窗口内请求数超过阈值
- **THEN** 系统 SHALL 返回 429
- **AND** 响应 MUST 使用统一错误信封
- **AND** 响应 MUST 包含 `retry_after`（秒）
- **AND** 响应头 SHOULD 包含 `Retry-After`（秒）

### Requirement: Health Endpoints MUST Not Be Rate Limited by Guardrails
guardrails 的 rate limiting MUST 不影响探活与诊断用健康检查端点。

#### Scenario: Health endpoints remain accessible under heavy load
- **WHEN** guardrails 启用且 rate limiting 生效
- **THEN** `/health` 与 `/health/dependencies` SHALL 不受该 rate limiting 影响

### Requirement: Rate Limit Identity MUST Be Safe by Default
系统 MUST 提供一个“安全默认”的 client identity 策略用于 rate limit keying，并且默认 MUST 不信任可伪造的代理头（例如 `X-Forwarded-For`）。

#### Scenario: Proxy headers are ignored by default
- **WHEN** 客户端请求携带 `X-Forwarded-For`
- **AND** 运维未显式开启“信任代理头”的配置
- **THEN** 系统 SHALL 使用直接连接的 client 地址（例如 socket remote addr）作为 rate limit key
