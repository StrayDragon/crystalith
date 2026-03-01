# chat-ui-envelope Specification

## Purpose

定义一种可持久化、可回放、可扩展的“对话内 UI”消息表达协议：后端在 assistant 消息 `content` 中嵌入版本化 JSON envelope，前端将其解析为可渲染的内容块（text/component/tool_use/tool_result），并在必要时支持对组件 props 的流式更新与动作执行的可观察回写。

## Non-goals

- 不规定具体 UI 视觉风格、布局与动画细节
- 不要求引入新的 `/v2/messages` 或新增结构化字段（本规范以 `content: string` 为载体）
- 不允许在 envelope 中包含任意可执行脚本/表达式
- 不要求 LLM 直接生成可执行动作；动作的执行权限与白名单策略由宿主（Crystalith）控制

## Requirements

### Requirement: UI envelope is versioned and parseable inside message content
当系统需要在对话中表达可渲染 UI 时，assistant 消息 `content` MUST 采用如下格式追加 UI envelope：

`<fallback_text> + "\\n\\n[[crystalith-ui:v1]]\\n" + <json_envelope>`

其中：
- `<fallback_text>` MUST 为非空的人类可读文本（用于不支持 UI 的客户端或解析失败时的回退显示）
- `<json_envelope>` MUST 为单个 JSON object（UTF-8）且可被 `JSON.parse` 成功解析
- JSON MUST 包含 `schema = "crystalith.ui.message.v1"` 与 `parts` 字段

#### Scenario: Client splits content by delimiter
- **WHEN** 客户端收到一条 assistant 消息且 `content` 包含 delimiter `[[crystalith-ui:v1]]`
- **THEN** 客户端 SHALL 以 delimiter 将 `fallback_text` 与 `json_envelope` 分离
- **AND** 若 `json_envelope` 解析失败，客户端 SHALL 仅展示 `fallback_text` 且保持对话可用

### Requirement: Envelope schema and parts are typed and stable
`json_envelope` MUST 满足：
- `schema: "crystalith.ui.message.v1"`
- `parts: array` 且每个元素 MUST 是对象并包含 `type`

系统 MUST 支持以下 `type` 集合（最小集合）：
- `text`
- `component`
- `tool_use`
- `tool_result`

#### Scenario: Unknown part types do not break rendering
- **WHEN** `parts[]` 中出现未知 `type`
- **THEN** 客户端 SHALL 忽略该 part 并继续渲染其它已知 parts

### Requirement: Text parts support markdown as data
当 part `type = "text"` 时：
- part MUST 包含 `format` 与 `text`
- `format` MUST 为 `"markdown"`
- `text` MUST 为字符串

#### Scenario: Text part renders as markdown
- **WHEN** envelope 包含 `type="text"` 的 part
- **THEN** 客户端 SHALL 将其作为 markdown 文本渲染（以数据方式处理，不执行任意脚本）

### Requirement: Component parts are rendered via a registry with safe fallback
当 part `type = "component"` 时：
- part MUST 包含 `name`, `id`, `props`
- `name` MUST 为字符串且映射到宿主的 component registry
- `id` MUST 为 message-local 的稳定标识（用于更新/引用）
- `props` MUST 是 JSON object

客户端 MUST 使用 registry 渲染组件；若 `name` 未注册或 `props` 校验失败，客户端 MUST 渲染安全回退（例如展示该 part 的 JSON 摘要），且 MUST 不影响其它 parts 的渲染。

#### Scenario: Unknown component falls back
- **WHEN** envelope 包含 `type="component"` 但 `name` 未在 registry 中注册
- **THEN** 客户端 SHALL 渲染回退视图并显示最小可诊断信息（name/id）
- **AND** 客户端 SHALL 继续渲染同一消息中的其它 parts

### Requirement: Component parts can be flagged as streaming-updatable
当 part `type = "component"` 且包含 `streaming: true` 时：
- 客户端 MUST 允许在同一条消息的流式生命周期内对该 component 的 `props` 进行增量更新并触发重渲染
- 最终持久化的 message `content` MUST 反映完成态 props（用于刷新后的回放渲染）

#### Scenario: Streaming component updates during SSE chunks
- **WHEN** 客户端处于消息流式生成中并接收到新的文本 chunk
- **THEN** 客户端 SHALL 将该 chunk 追加到某个 streaming component 的 props（由宿主策略决定映射关系）
- **AND** 用户在流式过程中 SHALL 能观察到组件逐步更新

### Requirement: Tool use parts are gated and auditable
当 part `type = "tool_use"` 时：
- part MUST 包含 `id`, `name`, `input`
- `id` MUST 为消息内唯一标识
- `input` MUST 是 JSON object
- part MAY 包含 `auto_execute` 与 `requires_confirm`

客户端 MUST 将 tool 执行限制为宿主内置动作集合：
- 若 `auto_execute = true`，客户端仍 MUST 仅在宿主白名单允许该 `name` 时自动执行
- 若 `requires_confirm = true` 或 tool 不在白名单内，客户端 MUST 需要用户显式确认才可执行

#### Scenario: Non-whitelisted tool requires confirmation
- **WHEN** tool_use 的 `name` 不在宿主白名单内
- **THEN** 客户端 SHALL 不自动执行该 tool
- **AND** 客户端 SHALL 以可操作 UI 请求用户确认或修改输入

### Requirement: Tool result parts correlate to tool_use and are rendered
当 part `type = "tool_result"` 时：
- part MUST 包含 `tool_use_id` 与 `status`
- `tool_use_id` MUST 引用同一消息内已出现的 `tool_use.id`
- `status` MUST 为 `"success"` 或 `"error"`

客户端 MUST 将 `tool_result` 与对应 `tool_use` 关联显示，并在失败时提供最小可恢复路径（例如重试入口，若宿主允许）。

#### Scenario: Tool result is shown next to tool use
- **WHEN** 同一消息包含 `tool_use` 与匹配的 `tool_result`
- **THEN** 客户端 SHALL 将结果与动作关联展示
- **AND** 若 `status="error"`，客户端 SHALL 显示错误信息（如存在）并保持对话可用

### Requirement: Envelope parsing is resource-bounded
客户端在解析 envelope 时 MUST 施加资源上限（至少包括）：
- 最大 JSON 字节数上限
- `parts` 数量上限
- JSON 嵌套深度上限

#### Scenario: Oversized envelope does not freeze UI
- **WHEN** 客户端遇到超过资源上限的 envelope
- **THEN** 客户端 SHALL 放弃解析并回退展示 `fallback_text`
- **AND** UI SHALL 保持可用且不出现长时间卡顿

