# workspace-api-contract Specification

## Purpose

定义前后端协作所依赖的稳定 API 契约：版本前缀、错误信封、核心端点稳定字段与 SSE 事件最小形状。

## Non-goals

- 不替代 OpenAPI 全量细节
- 不定义具体前端组件行为

## Requirements

### Requirement: API major version prefix is stable
对外 API MUST 使用 `/v1` 前缀；同一 major 内保持兼容。

### Requirement: Non-SSE errors use unified envelope
非 SSE 错误响应 MUST 使用统一结构：`error_code`, `message`, `details?`, `retry_after?`。

### Requirement: Notebook/session/message endpoints are stable
notebook、session、message 的范围归属与 404/400 语义 MUST 稳定。

### Requirement: QA endpoints provide stable stream and non-stream contracts
`/qa` 与 `/qa/stream` MUST 保持稳定字段语义，stream 至少包含 `chunk|done|error` 事件。

### Requirement: Citation model is unified across APIs
citation 对象结构 MUST 在 QA/messages/outputs 中保持一致且索引映射为 1-based。

### Requirement: Workspace tools and outputs endpoints are stable
`/v1/workspace/tools` 与 outputs/slides 相关端点 MUST 保持可用与向后兼容。
