# python-sdk Specification

## Purpose
TBD - created by archiving change add-python-sdk-automation. Update Purpose after archive.
## Requirements
### Requirement: 手动触发的 SDK 发布
系统 SHALL 提供手动触发的 GitHub Actions 发布流程用于发布 Python SDK。

#### Scenario: 手动发布成功
- **WHEN** 手动触发发布流程并提供版本 `1.2.3`
- **THEN** 校验 `sdk/client/python` 中的 SDK 版本为 `1.2.3`
- **AND** 发布到 PyPI

#### Scenario: Tag 不触发发布
- **WHEN** 推送 tag `v1.2.3`
- **THEN** 不自动触发 SDK 发布流程

### Requirement: OpenAPI 作为唯一生成来源
系统 SHALL 以当前后端 OpenAPI JSON 作为 SDK 生成的唯一输入。

#### Scenario: Schema 变更被纳入 SDK
- **WHEN** OpenAPI schema 发生变更并发布新 tag
- **THEN** 新发布的 SDK 反映该变更

### Requirement: Release workflow validates SDK freshness
系统 SHALL 在 Python SDK 发布 workflow 中验证 `sdk/client/python` 与当前后端 OpenAPI schema 一致，并在不一致时 fail-fast，避免发布过期 SDK。

#### Scenario: SDK 过期阻止发布
- **WHEN** 发布 workflow 运行并发现生成 SDK 与仓库内容存在 diff
- **THEN** workflow 失败
- **AND** 不发布到 PyPI

#### Scenario: SDK 最新允许发布
- **WHEN** 发布 workflow 验证 SDK 无 diff
- **THEN** workflow 继续构建并发布到 PyPI

### Requirement: SDK 包名与 Python 版本策略
系统 SHALL 使用与项目同名的 PyPI 包名发布 SDK，且明确支持的 Python 版本范围。

#### Scenario: 包名可用
- **WHEN** PyPI 上 `crystalith` 未被占用
- **THEN** 以 `crystalith` 作为发布包名

#### Scenario: 包名被占用
- **WHEN** PyPI 上 `crystalith` 已被占用
- **THEN** 使用后备包名 `crystalith-sdk`

#### Scenario: Python 版本下限
- **WHEN** 发布 SDK 到 PyPI
- **THEN** 声明 Python 版本下限为 `>=3.10`

### Requirement: SDK 生成产物目录
系统 SHALL 将 SDK 生成产物落位在仓库 `sdk/client/python`，并视为自动生成内容。

#### Scenario: 生成覆盖
- **WHEN** 手动执行 SDK 生成流程
- **THEN** 生成器覆盖写入 `sdk/client/python` 的内容
- **AND** 不要求手工修改生成文件

### Requirement: PyPI 发布最佳实践
系统 SHALL 优先使用 PyPI Trusted Publishing（OIDC）发布 SDK，如无法配置则回退 API token。

#### Scenario: OIDC 可用
- **WHEN** GitHub Actions 配置了 PyPI Trusted Publishing
- **THEN** 使用 OIDC 发布 SDK

#### Scenario: OIDC 不可用
- **WHEN** 未配置 Trusted Publishing
- **THEN** 使用 PyPI API token 发布 SDK

### Requirement: Fern 生成器
系统 SHALL 使用 Fern 生成 Python SDK。

#### Scenario: 使用 Fern 生成
- **WHEN** 执行 SDK 生成流程
- **THEN** 通过 Fern CLI 生成 SDK

### Requirement: SDK 版本对齐后端
系统 SHALL 确保 SDK 版本与 `backend/py/pyproject.toml` 一致，并写入 `sdk/client/python/.sdk-version`。

#### Scenario: 版本一致
- **WHEN** 生成 SDK
- **THEN** `sdk/client/python/.sdk-version` 内容等于后端版本
