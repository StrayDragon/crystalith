# openapi-and-client-generation Specification

## Purpose

定义 OpenAPI 暴露与多端客户端生成链路，确保后端 schema、前端生成客户端与 Python SDK 一致。

## Non-goals

- 不定义 PyPI 发布策略
- 不定义具体业务流程

## Requirements

### Requirement: OpenAPI JSON and UI endpoints are exposed
系统 MUST 提供 OpenAPI JSON 与可交互 UI 端点。

### Requirement: OpenAPI is the single source of truth for generated clients
前端生成客户端与 Python SDK MUST 基于同一 OpenAPI 生成。

### Requirement: Generated frontend client is default path
前端新增 API 调用 MUST 优先使用生成客户端；手写调用仅限 SSE/流式等例外。

### Requirement: Python SDK generation is deterministic
Python SDK 生成流程 MUST 可重复，并与后端版本保持一致。

### Requirement: CI validates schema/client/sdk freshness
CI MUST 校验 OpenAPI、前端生成代码、SDK 产物无漂移。
