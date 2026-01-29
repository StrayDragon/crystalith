## ADDED Requirements
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
