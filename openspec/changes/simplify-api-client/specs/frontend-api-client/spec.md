# frontend-api-client Specification (Change: simplify-api-client)

## ADDED Requirements

### Requirement: Generated client is the default API surface
系统 MUST 使用 OpenAPI 生成的前端客户端作为新增 API 调用的首选方式，仅在生成客户端无法覆盖时才允许手写 `fetch` 调用。

#### Scenario: 新增 API 调用
- **WHEN** 前端新增一个 API 调用
- **THEN** 必须优先使用 `frontend/web/src/api/generated` 中的函数
- **AND** 仅在 OpenAPI 未覆盖时才允许新增手写调用，并注明原因

### Requirement: Manual endpoints are isolated and documented
系统 MUST 将手写 API 调用集中在一个小的模块中，并在模块内说明为何不能由 OpenAPI 生成覆盖。

#### Scenario: 使用手写调用
- **WHEN** 需要使用手写 API 调用
- **THEN** 该调用必须位于单独模块内（例如 `api/manual.ts`）
- **AND** 每个手写调用必须说明其 OpenAPI 缺失原因或特殊技术需求（如 SSE）

### Requirement: Error handling remains consistent
系统 MUST 为手写调用提供一致的错误抛出方式，避免调用方在生成客户端与手写调用之间出现错误处理分叉。

#### Scenario: 手写调用失败
- **WHEN** 手写 API 调用返回非 2xx
- **THEN** 必须抛出统一的错误类型或结构（与现有前端错误处理兼容）
- **AND** 调用方不需要额外分支来区分生成客户端与手写调用
