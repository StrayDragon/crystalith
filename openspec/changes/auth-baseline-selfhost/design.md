## Context

- 自托管默认拓扑下，`web` 会对外暴露 `/v1/*`（反代到后端），而后端当前没有统一鉴权机制；任何能访问该端口的人都可读写所有数据并触发上游模型调用。
- 项目当前没有用户/租户模型，因此短期最合理的“安全基线”是单租户的全局 API key（可选启用），而不是复杂的 RBAC。

## Goals / Non-Goals

**Goals:**

- 提供一个可选启用的 API key / Bearer token 鉴权基线：
  - 默认关闭（不配置密钥即匿名可用，保持本地开发与 Demo 的低摩擦）。
  - 启用后：所有 `/v1/**` 端点要求 token；返回稳定 401 语义与错误信封。
  - `/health` 与 `/health/dependencies` 保持匿名访问（Docker healthcheck/运维探测）。
- 形成完整文档闭环：明确风险、配置方式、curl/SDK 使用方式。

**Non-Goals:**

- 不引入多用户体系、登录页、权限模型或 per-notebook 授权。
- 不要求对 OpenAPI UI/JSON 做完全保护（可作为后续增强）。

## Decisions

1. **鉴权协议：优先标准 Bearer**
   - 主协议：`Authorization: Bearer <token>`（标准、兼容 SDK/代理/浏览器工具）。
   - 兼容（可选）：`X-API-Key: <token>`，用于 curl/工具便捷。

2. **启用方式：配置驱动，默认关闭**
   - 在配置中引入 `app.auth`（或等价命名）：
     - 未设置 `api_key`（或 `enabled=false`）→ 允许匿名；
     - 设置 `api_key`（且 enabled）→ 强制鉴权。
   - 密钥推荐通过 `${{ env.* }}` / `${{ secrets.* }}` 注入，避免明文入库。

3. **落点：路由注册层统一依赖（而非散落到每个端点）**
   - 在路由 include 时统一挂载 `Depends(require_api_key)`，覆盖所有 `/v1` 业务路由。
   - `/health` 系列路由不挂载鉴权依赖，保持匿名。

4. **错误语义：遵循现有错误信封**
   - 未携带或无效 token 返回 401，并使用统一错误结构（`error_code`, `message`, `details?`）。
   - 推荐错误码：
     - `AUTH_REQUIRED`（未携带 token）
     - `AUTH_INVALID`（token 校验失败）
   - 响应头包含 `WWW-Authenticate: Bearer` 以符合标准。

5. **OpenAPI 表达（可选）**
   - 如在 OpenAPI 中增加 security scheme，需要同步：
     - `frontend/web/openapi.json`
     - 生成客户端与 Python SDK
     - SDK 文档示例（headers）
   - 若短期不想改变 OpenAPI，可先实现鉴权逻辑与文档警告，再在后续迭代补齐 schema 表达。

## Risks / Trade-offs

- **[风险] 启用鉴权后影响现有用户与自动化脚本** → **缓解**：默认关闭；文档明确如何传递 headers；对 401 提供清晰错误码与提示。
- **[风险] 代理/反代层丢弃 Authorization 头** → **缓解**：文档提示需要保留 `Authorization` 头；可选兼容 `X-API-Key`。
- **[风险] 仅 API key 仍不足以满足多用户场景** → **缓解**：将其定位为单租户安全基线，并为后续 authn/authz 变更留出扩展点（新的 capability/change）。
