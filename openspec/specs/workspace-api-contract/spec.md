# workspace-api-contract Specification

## Purpose

定义前后端协作所依赖的稳定 API 契约：版本前缀、错误信封、核心端点稳定字段与 SSE 事件最小形状。

## Non-goals

- 不替代 OpenAPI 全量细节
- 不定义具体前端组件行为

## Requirements

### Requirement: API major version prefix is stable
对外 API MUST 使用 `/v1` 前缀；同一 major 内保持兼容。

#### Scenario: Client targets stable major prefix
- **WHEN** 客户端调用对外 API
- **THEN** 端点 SHALL 使用 `/v1` 前缀且在同一 major 内保持兼容

### Requirement: Non-SSE errors use unified envelope
非 SSE 错误响应 MUST 使用统一结构：`error_code`, `message`, `details?`, `retry_after?`。

#### Scenario: Non-SSE error envelope is consistent
- **WHEN** 非 SSE 请求发生错误
- **THEN** 系统 SHALL 返回统一错误结构并包含 `error_code` 与 `message`

### Requirement: Notebook/session/message endpoints are stable
notebook、session、message 的范围归属与 404/400 语义 MUST 稳定。

#### Scenario: Stable error semantics for ownership and validation
- **WHEN** 请求引用了不存在或不属于当前 notebook 的 session/message
- **THEN** 系统 SHALL 以稳定的 404/400 语义响应

### Requirement: QA endpoints provide stable stream and non-stream contracts
`/qa` 与 `/qa/stream` MUST 保持稳定字段语义，stream 至少包含 `chunk|done|error` 事件。

#### Scenario: QA stream emits minimal event set
- **WHEN** 客户端使用 `/qa/stream` 发起问答
- **THEN** stream SHALL 至少包含 `chunk|done|error` 事件并保持字段语义稳定

### Requirement: Citation model is unified across APIs
citation 对象结构 MUST 在 QA/messages/outputs 中保持一致且索引映射为 1-based。

#### Scenario: Citations are consistent across endpoints
- **WHEN** QA/messages/outputs 返回 citation 对象
- **THEN** citation 结构 SHALL 保持一致且索引映射为 1-based

### Requirement: Workspace tools and outputs endpoints are stable
`/v1/workspace/tools` 与 outputs/slides 相关端点 MUST 保持可用与向后兼容。

#### Scenario: Tools and outputs endpoints stay compatible
- **WHEN** 前端依赖 `/v1/workspace/tools` 与 outputs/slides 端点
- **THEN** 系统 SHALL 保持端点可用且向后兼容
