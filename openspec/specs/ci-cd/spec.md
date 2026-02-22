# ci-cd Specification

## Purpose

定义仓库的 CI/CD 最小闭环：在 push/PR 触发后端与前端测试/构建，并校验 OpenAPI 与前端生成客户端一致，确保主分支与 PR 的质量门槛可自动验证。

## Related specs

- `GLOSSARY.md`
- `deployment/spec.md`
- `openapi-docs/spec.md`
- `frontend-api-client/spec.md`

## Requirements
### Requirement: PR and push CI pipeline
系统 MUST 在 `push` 与 `pull_request` 事件上运行 CI，并为每个 PR 提供可见的状态检查结果。

### Requirement: Backend tests in CI
系统 MUST 在 CI 中使用 uv 安装后端依赖并运行后端测试套件。
最小要求：`cd backend/py && uv sync` + `cd backend/py && just test`。

### Requirement: Frontend tests and build in CI
系统 MUST 在 CI 中使用 pnpm 安装依赖并运行前端单测与构建。
最小要求：`cd frontend/web && pnpm install --frozen-lockfile` + `pnpm test` + `pnpm run build`。

### Requirement: OpenAPI and generated clients are consistent
系统 MUST 在 CI 中验证 OpenAPI 与生成客户端保持一致，避免“后端已变更但前端生成代码未更新”的漂移。
最小要求：OpenAPI 校验通过（例如 `cd backend/py && uv run scripts/api_schema.py check -s ../../frontend/web/openapi.json`），且生成客户端不产生未提交 diff。
