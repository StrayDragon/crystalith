# openapi-and-client-generation Specification

## Purpose

定义 OpenAPI 暴露与多端客户端生成链路，确保后端 schema、前端生成客户端与 Python SDK 一致。该规范用于约束“契约是单一真源”，避免多处手写接口导致漂移。

## Non-goals

- 不定义 PyPI 发布策略
- 不定义具体业务流程

## Requirements

### Requirement: OpenAPI JSON and UI endpoints are exposed
系统 MUST 提供 OpenAPI JSON 与可交互 UI 端点。

#### Scenario: Operator accesses API docs
- **WHEN** 开发者或操作者访问 API 文档入口
- **THEN** 系统 SHALL 提供 OpenAPI JSON 与可交互 UI 端点

### Requirement: OpenAPI is the single source of truth for generated clients
前端生成客户端与 Python SDK MUST 基于同一 OpenAPI 生成。

#### Scenario: Generate clients from the same schema
- **WHEN** 执行前端客户端与 Python SDK 生成
- **THEN** 两者 SHALL 基于同一 OpenAPI schema 产出

### Requirement: Generated frontend client is default path
前端新增 API 调用 MUST 优先使用生成客户端；手写调用仅限 SSE/流式等例外。

#### Scenario: Add a new frontend API call
- **WHEN** 前端新增一个非 SSE/流式的 API 调用
- **THEN** 该调用 SHALL 通过生成客户端完成而非手写请求

### Requirement: Python SDK generation is deterministic
Python SDK 生成流程 MUST 可重复，并与后端版本保持一致。

#### Scenario: Re-running SDK generation is stable
- **WHEN** 在同一后端版本上重复运行 SDK 生成流程
- **THEN** 产物 SHALL 保持可重复并与后端版本一致

### Requirement: CI validates schema/client/sdk freshness
CI MUST 校验 OpenAPI、前端生成代码、SDK 产物无漂移。

#### Scenario: Drift is detected
- **WHEN** OpenAPI 或生成客户端/SDK 与仓库提交内容不一致
- **THEN** CI SHALL 检测到漂移并失败提示

### Requirement: OpenAPI schema export artifact is committed at a stable path
仓库 MUST 将后端 OpenAPI schema 的导出产物固定为 `frontend/web/openapi.gen.json`，并将其作为前端生成客户端与各语言 SDK 生成的唯一输入。

#### Scenario: Generation uses the canonical exported schema
- **WHEN** 开发者执行 OpenAPI 导出与客户端/SDK 生成
- **THEN** 生成链路 SHALL 以 `frontend/web/openapi.gen.json` 作为唯一 schema 输入
