## ADDED Requirements

### Requirement: Optional API key authentication is supported for self-host
自托管部署 MUST 支持可选的 API key 鉴权基线：当配置了鉴权密钥时，所有 `/v1/**` 端点 MUST 要求 `Authorization: Bearer <token>`（或等价 API key 头）；未配置密钥时系统 MAY 允许匿名访问以保持本地开发低摩擦。

#### Scenario: Auth enabled requires bearer token for /v1
- **WHEN** 运维启用鉴权并配置了 API key
- **THEN** 客户端请求任意 `/v1/**` 端点若未携带有效 token SHALL 返回 401
- **AND** 响应 MUST 使用统一错误信封（`error_code`, `message`, `details?`）
- **AND** 响应头 SHOULD 包含 `WWW-Authenticate: Bearer`

#### Scenario: Health endpoints remain accessible without auth
- **WHEN** 运维启用鉴权并配置了 API key
- **THEN** `/health` 与 `/health/dependencies` SHALL 保持匿名可访问以支持探活与运维诊断
