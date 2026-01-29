# openapi-docs Specification

## Purpose
TBD - created by archiving change add-research-workspace. Update Purpose after archive.
## Requirements
### Requirement: OpenAPI JSON 端点
系统 SHALL 在 `/v1/codev/openapi.json` 提供 OpenAPI JSON 文档。

#### Scenario: 获取 OpenAPI JSON
- **WHEN** 访问 `/v1/codev/openapi.json`
- **THEN** 返回当前 API 的 OpenAPI JSON 文档

### Requirement: Scalar UI 端点
系统 SHALL 使用 scalar-fastapi 在 `/v1/codev/openapi-ui/scalar` 提供 OpenAPI UI。

#### Scenario: 打开 OpenAPI UI
- **WHEN** 访问 `/v1/codev/openapi-ui/scalar`
- **THEN** 展示基于 OpenAPI JSON 的 Scalar UI

### Requirement: 枚举值展示
系统 SHALL 在 OpenAPI schema 中展示枚举字段的可选值。

#### Scenario: 枚举字段出现在 Schema
- **WHEN** 枚举字段参与 OpenAPI schema 生成
- **THEN** schema 中包含该枚举的可选值列表
