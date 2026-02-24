# ci-cd Specification

## ADDED Requirements

### Requirement: Default local test entrypoints MUST include guardrail checks
仓库默认测试入口（`backend/py just test` 与根目录 `just test`）MUST 默认执行关键 guardrails，避免把 schema/codegen/import 违规检查留到 CI 才暴露。

#### Scenario: Backend default test command runs backend guardrails
- **WHEN** 开发者运行 `cd backend/py && just test`
- **THEN** 命令会在测试流程中执行 import layering 与 config schema consistency 检查

#### Scenario: Root default test command runs repository guardrails
- **WHEN** 开发者在仓库根目录运行 `just test`
- **THEN** 命令会先执行 `just check`（含 OpenAPI 与 generated client 一致性检查）再执行 backend/frontend tests
