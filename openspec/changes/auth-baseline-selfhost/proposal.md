## Why

- 当前自托管默认形态下，`web` 会把 `/v1/*` 全量反代到后端，且后端没有任何请求鉴权。对外暴露时这意味着任何可访问该端口的人都能读写所有 notebook/source/output，并可能消耗配置的上游 API key（高风险）。需要一个“最小可用、可选启用”的鉴权基线，作为自托管走向公网或多用户环境前的安全护栏。

## What Changes

- 引入可选的 API Key / Bearer Token 鉴权（单租户、全局开关）：
  - 未配置密钥时保持现状（默认关闭，不破坏本地开发体验）。
  - 配置密钥后：所有 `/v1/**` 端点 MUST 要求 `Authorization: Bearer <token>`（可选兼容 `X-API-Key`），否则返回 401。
  - `/health` 与 `/health/dependencies` 保持匿名可访问（便于健康检查与运维探测）。
- 文档补齐：
  - 明确“默认无鉴权，不建议公网暴露”的警告；
  - 提供配置与使用示例（curl/SDK headers）。
- （如需要）在 OpenAPI 中表达该安全方案，并确保前端/SDK 生成与使用指引同步更新。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `workspace-api-contract`: API 在自托管场景下的最小鉴权契约（何时需要 token、哪些端点可匿名、错误语义与头部约定）需要被规范化。

## Impact

- Backend: 需要在路由注册层引入统一依赖或中间件，读取配置并执行 token 校验；可能新增配置项并更新 schema。
- Docs: 更新部署/运维/SDK 文档以说明鉴权与安全警告。
- OpenAPI/Clients: 若 OpenAPI 增加 security scheme，需同步生成前端客户端与 Python SDK（并更新示例）。
