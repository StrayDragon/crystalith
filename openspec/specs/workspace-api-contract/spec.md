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

### Requirement: Optional API key authentication is supported for self-host
自托管部署 MUST 支持可选的 API key 鉴权基线：当配置了鉴权密钥时，所有 `/v1/**` 端点 MUST 要求 `Authorization: Bearer <token>`（或等价 API key 头）；未配置密钥时系统 MAY 允许匿名访问以保持本地开发低摩擦。

#### Scenario: Auth enabled requires bearer token for /v1
- **WHEN** 运维启用鉴权并配置了 API key
- **THEN** 客户端请求任意 `/v1/**` 端点若未携带有效 token SHALL 返回 401
- **AND** 响应 MUST 使用统一错误信封（`error_code`, `message`, `details?`）
- **AND** 响应头 SHOULD 包含 `WWW-Authenticate: Bearer`

#### Scenario: Health endpoints remain accessible without auth
- **WHEN** 运维启用鉴权并配置了 API key
- **THEN** `/health` 与 `/health/dependencies` SHALL 保持匿名可访问以支持探活与运维诊断

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
citation 对象 MUST 在 QA/messages/outputs 等对外 API 中保持字段语义一致，并包含最小可定位字段集。

#### Scenario: Citations are consistent across endpoints
- **WHEN** QA/messages/outputs 返回 citation 对象
- **THEN** citation 结构 SHALL 保持一致
- **AND** citation SHALL 至少包含 `source_id`, `source_name`, `chunk_id`, `chunk_index`, `snippet`
- **AND** `chunk_index` SHALL 表示在该 source 内的稳定顺序（1-based）

### Requirement: Citation context lookup is supported
系统 MUST 提供可按 citation 定位并获取上下文的稳定端点，以支持用户复查证据链。

#### Scenario: Fetch citation context
- **WHEN** 客户端请求某 citation 的上下文
- **THEN** 系统 SHALL 返回片段前后文（或等价上下文）与页码/段落等元信息（如可用）

### Requirement: Exports can include citations
系统 MUST 支持将 QA/Outputs 导出为包含 citations 的格式（Markdown/JSON 或等价），以便分享与复盘。

#### Scenario: Export includes citation list
- **WHEN** 用户导出 QA 或某个 Output
- **THEN** 导出结果 SHALL 包含引用清单与可定位信息（source_id 或可解析来源标识）

### Requirement: Workspace tools and outputs endpoints are stable
`/v1/workspace/tools` 与 outputs/slides 相关端点 MUST 保持可用与向后兼容。

#### Scenario: Tools and outputs endpoints stay compatible
- **WHEN** 前端依赖 `/v1/workspace/tools` 与 outputs/slides 端点
- **THEN** 系统 SHALL 保持端点可用且向后兼容

### Requirement: Workspace tools expose a complete config_schema
`/v1/workspace/tools` 返回的工具对象 MUST 包含可直接驱动 UI 的 `config_schema`（如支持主题、数量/难度选项与默认值）。

#### Scenario: Studio UI renders from tools list only
- **WHEN** 客户端请求 `/v1/workspace/tools`
- **THEN** 返回的每个 tool SHALL 包含其 `config_schema`（若该 tool 支持配置）
- **AND** UI SHALL 能仅依赖该响应渲染配置弹窗而无需额外请求

### Requirement: Tool config endpoint stays consistent (if present)
若 `/v1/workspace/tools/{tool_id}/config` 端点存在，其返回值 MUST 与 tools 列表中的 `config_schema` 语义一致。

#### Scenario: Config endpoint matches config_schema
- **WHEN** 客户端请求 `/v1/workspace/tools/{tool_id}/config`
- **THEN** 返回的选项集合与默认值语义 SHALL 与对应 tool 的 `config_schema` 一致
