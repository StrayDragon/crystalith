# frontend-api-client Specification

## Purpose

定义前端 API 调用规范：以 OpenAPI 生成客户端作为默认 API surface，手写调用仅作为例外并集中管理，同时保证错误处理语义在“生成客户端/手写调用”之间保持一致。

## Related specs

- `GLOSSARY.md`
- `openapi-docs/spec.md`
- `workspace-api/spec.md`
- `frontend-module-structure/spec.md`

## Requirements
### Requirement: Generated client is the default API surface
系统 MUST 使用 OpenAPI 生成的前端客户端作为新增 API 调用的首选方式，仅在生成客户端无法覆盖时才允许手写 `fetch` 调用。
新增 API 调用时 MUST 优先使用 `frontend/web/src/api/generated`；仅在 OpenAPI 未覆盖时才允许新增手写调用，并注明原因。

### Requirement: Manual calls are allowed for SSE/streaming (and must be documented)
系统 MAY 在 OpenAPI 生成客户端无法覆盖时使用手写网络调用（典型：SSE/EventSource、流式下载等）。手写调用 MUST：

- 说明原因（为何无法由 OpenAPI 覆盖）
- 封装在就近的 domain helper/hook（或 shared helper）中，避免散落在组件渲染层

### Requirement: Error handling remains consistent
系统 MUST 为手写调用提供一致的错误抛出方式，避免调用方在生成客户端与手写调用之间出现错误处理分叉。
手写 API 调用返回非 2xx 时 MUST 抛出与生成客户端兼容的统一错误类型/结构，调用方不需要额外分支区分两者。
