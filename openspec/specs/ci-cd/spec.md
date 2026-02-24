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

#### Scenario: CI triggers on pull request and push
- **WHEN** 有代码推送到受监控分支或创建/更新 pull request
- **THEN** CI workflow 被自动触发
- **AND** 仓库状态检查面板可看到该次执行结果

### Requirement: Backend tests in CI
系统 MUST 在 CI 中使用 uv 安装后端依赖并运行后端测试套件。
最小要求：`cd backend/py && uv sync` + `cd backend/py && just test`。

#### Scenario: Backend job runs with uv and tests
- **WHEN** CI 进入 backend job
- **THEN** job 使用 uv 同步依赖并执行后端测试命令
- **AND** 任一步失败都会将 job 标记为失败

### Requirement: Frontend tests and build in CI
系统 MUST 在 CI 中使用 pnpm 安装依赖并运行前端单测与构建。
最小要求：`cd frontend/web && pnpm install --frozen-lockfile` + `pnpm test` + `pnpm run build`。

#### Scenario: Frontend job runs tests and build
- **WHEN** CI 进入 frontend job
- **THEN** job 安装前端依赖并运行测试与构建
- **AND** 任一步失败都会将 job 标记为失败

### Requirement: OpenAPI and generated clients are consistent
系统 MUST 在 CI 中验证 OpenAPI 与生成客户端保持一致，避免“后端已变更但前端生成代码未更新”的漂移。
最小要求：OpenAPI 校验通过（例如 `cd backend/py && uv run scripts/api_schema.py check -s ../../frontend/web/openapi.json`），且生成客户端不产生未提交 diff。

#### Scenario: CI fails when schema or generated clients drift
- **WHEN** 后端 API 变化但 `openapi.json` 或 `src/api/generated` 未同步更新
- **THEN** CI 中对应一致性检查失败
- **AND** 输出提示需要重新生成并提交相关文件

### Requirement: CI MUST validate import layering and config schema consistency
系统 MUST 在 CI 中验证关键 guardrails：

- 后端导入分层检查（例如 `backend/py && just check-imports`）
- 配置 schema 一致性检查（生成后 `git diff --exit-code config/app.schema.json`）

#### Scenario: PR fails when config schema is out of date
- **WHEN** PR 修改了 Settings/config 形状但未更新 `config/app.schema.json`
- **THEN** CI 失败并提示需要更新/提交 schema

#### Scenario: PR fails when import layering is violated
- **WHEN** PR 引入违反分层规则的 Python import
- **THEN** CI 失败并提示违反的文件/依赖方向

### Requirement: Default local test entrypoints MUST include guardrail checks
仓库默认测试入口（`backend/py just test` 与根目录 `just test`）MUST 默认执行关键 guardrails，避免把 schema/codegen/import 违规检查留到 CI 才暴露。

#### Scenario: Backend default test command runs backend guardrails
- **WHEN** 开发者运行 `cd backend/py && just test`
- **THEN** 命令会在测试流程中执行 import layering 与 config schema consistency 检查

#### Scenario: Root default test command runs repository guardrails
- **WHEN** 开发者在仓库根目录运行 `just test`
- **THEN** 命令会先执行 `just check`（含 OpenAPI 与 generated client 一致性检查）再执行 backend/frontend tests
