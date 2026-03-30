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

### Requirement: Rate limited responses use unified envelope and retry_after
系统 MUST 为 HTTP rate limiting 提供稳定的对外语义：返回 429，并在统一错误信封中暴露 `retry_after` 指引。

#### Scenario: Client receives 429 with retry guidance
- **WHEN** 客户端触发 rate limit
- **THEN** 系统 SHALL 返回 429
- **AND** 响应 MUST 使用统一错误信封（`error_code`, `message`, `details?`, `retry_after?`）
- **AND** 响应 MUST 包含 `retry_after`（秒）
- **AND** 响应头 SHOULD 包含 `Retry-After`（秒）

### Requirement: Health endpoints remain exempt from HTTP guardrails
系统的健康检查端点 MUST 保持可用于运维探活与诊断，不应因 guardrails 被拒绝。

#### Scenario: Health stays accessible while guardrails are enabled
- **WHEN** 运维启用 guardrails（非本地暴露或显式 enabled）
- **THEN** `/health` 与 `/health/dependencies` SHALL 仍可匿名访问

### Requirement: Notebook/session/message endpoints are stable
notebook、session、message 的范围归属与 404/400 语义 MUST 稳定。

#### Scenario: Stable error semantics for ownership and validation
- **WHEN** 请求引用了不存在或不属于当前 notebook 的 session/message
- **THEN** 系统 SHALL 以稳定的 404/400 语义响应

### Requirement: Assistant message content remains plain text while UI is transported out-of-band
系统 MUST 将 assistant 消息 `content: string` 保持为纯文本/markdown 回答；结构化 UI MUST 通过 session-scoped `shared_state.ui` 提供，而不是嵌入 `content`。

#### Scenario: List messages returns plain assistant content
- **WHEN** 客户端调用 messages 列表端点获取某条 assistant 消息
- **THEN** 响应中的 `content` SHALL 仅包含回答文本
- **AND** 任何对应的交互 UI SHALL 通过同 session 的 `shared_state.ui` 恢复

### Requirement: Session UI state endpoints are stable and server-authoritative
系统 MUST 提供 session-scoped UI 状态端点：
- `GET /v1/notebooks/{notebook_id}/sessions/{session_id}/ui/state`
- `POST /v1/notebooks/{notebook_id}/sessions/{session_id}/ui/event`

`GET` MUST 返回 `session_id`、`shared_state`、`shared_state_revision`；`POST` MUST 接收 `CUSTOM(name="ui.v1.event")`，并返回 `delta` 与最新 `shared_state_revision`。

#### Scenario: UI state snapshot restores a session
- **WHEN** 客户端请求 `/ui/state`
- **THEN** 系统 SHALL 返回该 session 当前的完整 `shared_state` snapshot 与 revision

#### Scenario: UI event endpoint is revision-aware and idempotent
- **WHEN** 客户端向 `/ui/event` 发送带 `clientRequestId` 与 `baseRevision` 的 `ui.v1.event`
- **THEN** 系统 SHALL 做幂等处理与 revision 冲突检查

### Requirement: Commands endpoint is available for autocomplete
系统 MUST 提供 `GET /v1/commands` 端点，供前端获取结构化命令列表以驱动自动补全。

#### Scenario: Commands endpoint returns command list
- **WHEN** 客户端请求 `GET /v1/commands`
- **THEN** 系统 SHALL 返回命令列表

### Requirement: Prompt presets CRUD endpoints are stable
系统 MUST 提供 prompt presets 的 CRUD 端点集合：

- `GET /v1/prompt-presets`：返回 built-in + custom 的 preset 列表
- `POST /v1/prompt-presets`：创建 custom preset 并返回 201
- `PATCH /v1/prompt-presets/{preset_id}`：更新 custom preset 并返回更新后的对象
- `DELETE /v1/prompt-presets/{preset_id}`：删除 custom preset 并返回 204

#### Scenario: List includes built-in and custom
- **WHEN** 客户端请求 `GET /v1/prompt-presets`
- **THEN** 返回列表 SHALL 同时包含 `source="builtin"` 与 `source="custom"` 项（如存在）

#### Scenario: Creating a preset returns 409 on conflicts
- **WHEN** 客户端创建一个 trigger 与 built-in 或已存在 custom 冲突的 preset
- **THEN** 系统 SHALL 返回 409

#### Scenario: Updating/deleting missing preset returns 404
- **WHEN** 客户端更新或删除一个不存在的 `preset_id`
- **THEN** 系统 SHALL 返回 404

### Requirement: QA endpoints accept in-band prompt directives in question
QA 端点 MUST 支持在 `question: string` 中内嵌 `/prompt:<preset> <query>` 指令，并在启用 presets 功能时以该指令选择受控的预设生成策略。

#### Scenario: QA non-stream respects /prompt directive
- **WHEN** 客户端调用 `/v1/notebooks/{notebook_id}/qa` 且 `question` 以 `/prompt:` 开头
- **THEN** 系统 SHALL 在不改变 `/v1` payload 字段形状的前提下解析指令并选择对应 preset

#### Scenario: QA stream respects /prompt directive
- **WHEN** 客户端调用 `/v1/notebooks/{notebook_id}/qa/stream` 且 `question` 以 `/prompt:` 开头
- **THEN** 系统 SHALL 解析指令并在 stream 中保持 `chunk|done|error` 的最小事件集语义稳定

### Requirement: QA endpoints provide stable stream and non-stream contracts
`/qa` 与 `/qa/stream` MUST 保持稳定字段语义，stream 至少包含 `chunk|done|error` 事件。

#### Scenario: QA stream emits minimal event set
- **WHEN** 客户端使用 `/qa/stream` 发起问答
- **THEN** stream SHALL 至少包含 `chunk|done|error` 事件并保持字段语义稳定

#### Scenario: QA stream carries shared UI state updates
- **WHEN** 客户端使用 `/qa/stream` 发起问答且该回答包含交互 UI
- **THEN** stream SHALL 保持 `chunk|done|error` 的最小事件集稳定
- **AND** SHALL 额外发送 `state_snapshot` 与可选的 `state_delta` 事件来传递 `shared_state.ui`

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
- **AND** 导出正文 SHALL 使用纯 assistant 文本内容
- **AND** 导出正文 SHALL 不包含 `[[crystalith-ui:v1]]` 或其他 legacy UI metadata

### Requirement: Workspace tools and outputs endpoints are stable
`/v1/workspace/tools` 与 outputs/slides 相关端点 MUST 保持可用与向后兼容；其中 `/v1/workspace/tools` 的“可用工具集合”允许随已安装/已启用插件变化而变化，但响应形状与字段语义 MUST 稳定。

#### Scenario: Tools endpoint stays compatible while tool set is dynamic
- **WHEN** 前端依赖 `/v1/workspace/tools` 获取工具列表
- **THEN** 系统 SHALL 保持端点可用且字段语义稳定
- **AND** 前端 SHALL 将 tools 列表视为权威来源，不得假设固定枚举集合

### Requirement: Workspace tools list returns available tools only
`/v1/workspace/tools` 返回的 tools 列表 MUST 仅包含“当前可用”的工具项（可用 = core 内置能力 + 已安装且已启用、并通过兼容性门禁的插件能力）。对于 `SLIDES`，其可用性 MUST 由当前 active `SlidesWorkflowPlugin` 决定，而不是由 core 默认内置。

#### Scenario: Disabled plugin removes tool but yields diagnostics
- **WHEN** 某输出类型插件被禁用或加载失败
- **THEN** tools 列表 SHALL 不包含该 tool
- **AND** 响应中的 `diagnostics` SHALL 提供结构化诊断信息（error_code/message/hint/details）说明不可用原因与恢复提示

#### Scenario: Missing or ambiguous slides plugin removes tool and yields diagnostics
- **WHEN** 系统未加载任何可生效的 slides workflow plugin，或同时发现多个候选但未能唯一确定 active plugin
- **THEN** tools 列表 SHALL 不包含 `SLIDES`
- **AND** 响应中的 `diagnostics` SHALL 提供结构化诊断信息（error_code / message / hint / details）说明不可用原因与恢复提示

### Requirement: Tools endpoint exposes diagnostics in a machine-readable form
`/v1/workspace/tools` 响应 MUST 暴露 `diagnostics` 字段，用于解释插件能力为什么可用/不可用，并为 UI 与自托管排障提供可执行提示。

`diagnostics` MUST 至少包含：

- `diagnostics.plugins.loaded: string[]`：本次启动加载成功的插件 id 列表
- `diagnostics.plugins.skipped: { [plugin_id: string]: { error_code: string, message: string, hint?: string, details?: object } }`：加载被跳过的插件与稳定 skip detail

为覆盖“官方插件未安装（无 entry point，因此不会出现在 skipped）”的场景，`diagnostics` MUST 额外包含一个轻量的 official catalog（仅字符串/提示，不引入重依赖），用于给出明确的安装/启用指引。

official catalog MUST 覆盖当前版本所定义的**全部官方插件**，包括官方 slides workflow plugins，以便 UI 能一致呈现官方能力矩阵与安装指引：

- `diagnostics.official: { [plugin_id: string]: { status: \"loaded\"|\"skipped\"|\"not_installed\", hint?: string, details?: object } }`

#### Scenario: Client renders missing-capability hints
- **WHEN** 客户端收到 tools 响应
- **THEN** 客户端 SHALL 能定位到缺失/禁用/未安装的插件条目
- **AND** SHALL 能将其中的 hint 直接展示为用户可执行的恢复步骤
- **AND** 对 `SLIDES` SHALL 能区分“未安装/未启用/未选定 active plugin”等不可用原因

### Requirement: Workspace tools can expose frontend_bundle descriptor
`/v1/workspace/tools` 返回的 tool 对象 MUST 支持可选字段 `frontend_bundle`，用于声明该输出类型的前端渲染 bundle。

#### Scenario: Tools response includes optional frontend_bundle
- **WHEN** 客户端请求 `/v1/workspace/tools`
- **THEN** 每个 tool 对象 MAY 包含 `frontend_bundle`
- **AND** `frontend_bundle` 缺省或为 null 时 SHALL 表示该 tool 没有可用的前端 bundle

### Requirement: Workspace tools expose a complete config_schema
`/v1/workspace/tools` 返回的工具对象 MUST 包含可直接驱动 UI 的 `config_schema`（如支持主题、数量/难度选项与默认值）。对于 `SLIDES`，该 `config_schema` MUST 覆盖 defaults、quantity / audience / structure / tone / language / density / theme / frontmatter，以及 active plugin 声明的 engine / preview 相关元数据；客户端 MUST NOT 依赖独立 slides config 端点。

#### Scenario: Studio UI renders from tools list only
- **WHEN** 客户端请求 `/v1/workspace/tools`
- **THEN** 返回的每个 tool SHALL 包含其 `config_schema`（若该 tool 支持配置）
- **AND** UI SHALL 能仅依赖该响应渲染配置弹窗而无需额外请求

#### Scenario: Slides config is derived from tools response only
- **WHEN** 客户端请求 `/v1/workspace/tools`
- **THEN** `SLIDES` tool（若存在） SHALL 在其 `config_schema` 中返回完整配置语义
- **AND** 客户端 SHALL 能仅依赖该响应渲染 slides 配置界面而无需额外请求

### Requirement: Tool config endpoint stays consistent (if present)
若 `/v1/workspace/tools/{tool_id}/config` 端点存在，其返回值 MUST 与 tools 列表中的 `config_schema` 语义一致。

#### Scenario: Config endpoint matches config_schema
- **WHEN** 客户端请求 `/v1/workspace/tools/{tool_id}/config`
- **THEN** 返回的选项集合与默认值语义 SHALL 与对应 tool 的 `config_schema` 一致
