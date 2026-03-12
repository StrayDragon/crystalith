# openapi-and-client-generation 规范增量

## ADDED Requirements

### Requirement: OpenAPI 导出产物必须使用 `frontend/web/openapi.gen.json`
仓库 MUST 将后端 OpenAPI schema 的导出产物固定为 `frontend/web/openapi.gen.json`，并将其作为前端生成客户端与各语言 SDK 生成的唯一输入。

#### Scenario: 生成链路使用统一 schema 输入
- **WHEN** 开发者执行 OpenAPI 导出与客户端/SDK 生成
- **THEN** 生成链路 SHALL 以 `frontend/web/openapi.gen.json` 作为唯一 schema 输入
