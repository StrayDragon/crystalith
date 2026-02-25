# ci-cd (delta) Specification

## ADDED Requirements

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
