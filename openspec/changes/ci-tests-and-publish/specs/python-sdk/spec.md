## ADDED Requirements

### Requirement: Release workflow validates SDK freshness
系统 MUST 在 Python SDK 发布 workflow 中验证 `sdk/client/python` 与当前后端 OpenAPI schema 一致，并在不一致时 fail-fast，避免发布过期 SDK。

#### Scenario: SDK 过期阻止发布
- **WHEN** 发布 workflow 运行并发现生成 SDK 与仓库内容存在 diff
- **THEN** workflow 失败
- **AND** 不发布到 PyPI

#### Scenario: SDK 最新允许发布
- **WHEN** 发布 workflow 验证 SDK 无 diff
- **THEN** workflow 继续构建并发布到 PyPI

