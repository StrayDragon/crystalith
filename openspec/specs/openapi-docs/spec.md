# openapi-docs Specification

## Purpose

定义 OpenAPI 文档的对外暴露方式：提供 OpenAPI JSON 与可交互的 API UI 端点，并确保枚举等 schema 信息完整呈现，便于前端/SDK 生成与调试。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`
- `frontend-api-client/spec.md`
- `python-sdk/spec.md`
- `docs-site/spec.md`

## Requirements
### Requirement: OpenAPI JSON 端点
系统 SHALL 在 `/v1/codev/openapi.json` 提供 OpenAPI JSON 文档。

### Requirement: Scalar UI 端点
系统 SHALL 使用 scalar-fastapi 在 `/v1/codev/openapi-ui/scalar` 提供 OpenAPI UI。

### Requirement: 枚举值展示
系统 SHALL 在 OpenAPI schema 中展示枚举字段的可选值。
