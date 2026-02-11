## ADDED Requirements

### Requirement: PR and push CI pipeline
系统 MUST 在 `push` 与 `pull_request` 事件上运行 CI，并为每个 PR 提供可见的状态检查结果。

#### Scenario: PR 触发
- **WHEN** 创建或更新 Pull Request
- **THEN** CI workflow 自动运行并报告成功/失败

#### Scenario: main push 触发
- **WHEN** 向 `main` 分支 push
- **THEN** CI workflow 自动运行

### Requirement: Backend tests in CI
系统 MUST 在 CI 中使用 uv 安装后端依赖并运行后端测试套件。

#### Scenario: 后端测试通过
- **WHEN** CI 执行后端 job
- **THEN** 通过 `cd backend/py && uv sync` 安装依赖
- **AND** 通过 `cd backend/py && just test` 运行测试并通过

### Requirement: Frontend tests and build in CI
系统 MUST 在 CI 中使用 pnpm 安装依赖并运行前端单测与构建。

#### Scenario: 前端构建通过
- **WHEN** CI 执行前端 job
- **THEN** 通过 `cd frontend/web && pnpm install --frozen-lockfile` 安装依赖
- **AND** 通过 `cd frontend/web && pnpm test` 运行测试并通过
- **AND** 通过 `cd frontend/web && pnpm run build` 完成构建

### Requirement: OpenAPI and generated clients are consistent
系统 MUST 在 CI 中验证 OpenAPI 与生成客户端保持一致，避免“后端已变更但前端生成代码未更新”的漂移。

#### Scenario: OpenAPI 文件一致
- **WHEN** CI 执行 API consistency job
- **THEN** 运行 `cd backend/py && uv run scripts/api_schema.py check -s ../../frontend/web/openapi.json` 并通过

#### Scenario: 生成客户端无 diff
- **WHEN** CI 执行 `cd frontend/web && pnpm run api:generate`
- **THEN** `frontend/web/src/api/generated` 不产生未提交 diff

