## 1. Backend：可选鉴权基线

- [x] 1.1 在配置模型中增加 `app.auth`（enabled/api_key 等），并更新 `config/app.schema.json` 生成链路。
- [x] 1.2 实现 `require_api_key` 依赖：支持 `Authorization: Bearer`（可选兼容 `X-API-Key`），使用常量时间比较，失败返回统一 401 错误信封与 `WWW-Authenticate` 头。
- [x] 1.3 在路由注册层统一挂载鉴权依赖到 `/v1/**` 业务路由；保持 `/health` 与 `/health/dependencies` 匿名可访问。
- [x] 1.4 增加后端测试覆盖：鉴权关闭时 `/v1` 可访问；鉴权开启时未携带 token 返回 401；health 端点仍可访问。

## 2. Docs：安全警告与使用说明

- [x] 2.1 更新 `docs/content/deployment.md` / `docs/content/operations.md`：明确默认无鉴权不建议公网暴露，并给出启用鉴权的示例（含 curl）。
- [x] 2.2 更新 `docs/content/configuration.md`：记录 `app.auth.*` 配置与 env/secrets 注入方式。
- [x] 2.3 更新 `docs/content/sdk-python.md` / `docs/content/sdk-typescript.md`：示例展示如何传递 `Authorization` header。

## 3. OpenAPI/Clients（可选）

- [x] 3.1 如在 OpenAPI 中表达 security scheme：同步更新 `frontend/web/openapi.json` 并再生成前端客户端与 Python SDK，确保 CI 无漂移。（本次未修改 OpenAPI security scheme）

## 4. Verification

- [x] 4.1 `cd backend/py && just test`
- [x] 4.2 `just docs-build`
- [x] 4.3 （如 OpenAPI 变更）`just api-sync` + `just sdk-check`（本次无 OpenAPI 变更）
- [x] 4.4 手动验收：开启鉴权后，未携带 token 调用 `/v1/notebooks` 返回 401；携带 token 正常；`/health` 仍可匿名访问。
