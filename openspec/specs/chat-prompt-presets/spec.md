# chat-prompt-presets Specification

## Purpose

定义 Chat 输入中的 `/prompt:*` 指令与后端 preset registry（built-in + custom）的稳定行为：如何解析指令、如何选择生成策略，以及各 preset 的最小输出契约（包含纯文本回答与可选的 session `shared_state.ui` 更新）。

## Non-goals

- 不定义 custom preset 的 CRUD/API 与管理 UI 细节（见 `workspace-api-contract` 与 `workspace-ui-panels`）
- 不引入新的 `/v2` API 或新增 QA request 字段（指令内嵌在 `question: string`）
- 不要求引入 Tambo threads 或 Tambo 服务端能力（仅展示侧组件渲染）

## Requirements

### Requirement: Prompt directives are parsed from QA question when enabled
当 `app.features.chat_prompt_presets_enabled=true` 时，系统 MUST 支持在 `question` 内解析 prompt 指令：

`/prompt:<preset> <query>`

其中：
- `<preset>` MUST 匹配正则：`[a-z0-9_-]{1,32}`（大小写不敏感，解析后统一为小写）
- `<query>` MAY 为空（空时视为输入错误）

#### Scenario: Directive selects a preset
- **WHEN** `question` 以 `/prompt:stats ` 开头且 presets 功能已启用
- **THEN** 系统 SHALL 选择 `stats` preset 的生成策略而不是默认 QA 策略

#### Scenario: Empty query returns deterministic error
- **WHEN** `question` 为 `/prompt:stats`（无 query）且 presets 功能已启用
- **THEN** 系统 SHALL 返回 400 并提示用法与可用 preset 列表

#### Scenario: Presets disabled returns deterministic error
- **WHEN** `question` 以 `/prompt:` 开头但 `app.features.chat_prompt_presets_enabled=false`
- **THEN** 系统 SHALL 返回 400（不应静默当作普通 QA 处理）

### Requirement: Unknown preset names are rejected with a stable list
系统 MUST 将 preset 集合视为白名单（built-in + custom）。未知 preset MUST 被拒绝并返回可用 preset 列表。

#### Scenario: Unknown preset is rejected
- **WHEN** `question` 为 `/prompt:unknown do something` 且 presets 功能已启用
- **THEN** 系统 SHALL 返回 400 并包含可用 preset 名称列表（包含 built-in 与 custom）

### Requirement: Custom prompt presets can override the QA system prompt
系统 MUST 支持用户定义的 custom preset。对于 `/prompt:<preset> <query>`：

- 若 `<preset>` 命中 custom preset 且 `enabled=true`，系统 MUST 使用该 preset 的 `system_prompt` 覆盖 QA pipeline 的 system message。
- 系统 MUST 将 `<query>` 作为实际 QA question 执行（不包含 `/prompt:` 前缀）。

#### Scenario: Custom preset overrides system prompt
- **WHEN** 用户存在 custom preset `demo` 且 `enabled=true`
- **AND** 客户端发送 `question="/prompt:demo hello"`
- **THEN** 系统 SHALL 以 `demo.system_prompt` 作为 system message 执行 QA
- **AND** SHALL 使用 `hello` 作为实际 query

### Requirement: Disabled presets are rejected deterministically
当 preset 存在但 `enabled=false` 时，系统 MUST 拒绝该请求并返回确定性错误。

#### Scenario: Disabled preset returns 400
- **WHEN** 用户存在 preset `demo` 且 `enabled=false`
- **AND** 客户端发送 `question="/prompt:demo hello"`
- **THEN** 系统 SHALL 返回 400
- **AND** SHALL 不执行 QA pipeline

### Requirement: Stats preset returns structured JSON and fallback markdown
当选择 `stats` preset 时，系统 MUST 使用受控的模型输出格式：模型最终输出 MUST 为单个 JSON object（无额外文本），且 MUST 满足：

- `fallback_markdown: string`（MUST 非空，且 SHOULD 含 inline citations，如 `[1]`）
- `chart: { title: string, unit?: string, items: [{ label: string, value: number }] }`
- `table?: { columns: string[], rows: (string|number|null)[][] }`

#### Scenario: Stats preset returns JSON only
- **WHEN** 系统执行 `stats` preset
- **THEN** 系统 SHALL 要求模型仅输出 JSON object（不含 code fence、解释文本或多段输出）

### Requirement: Stats structured output is validated and falls back safely
系统 MUST 对 stats JSON 做结构校验；若解析或校验失败，系统 MUST 回退到默认 QA 文本生成（并保持对话可用）。

#### Scenario: Invalid JSON falls back to text QA
- **WHEN** 模型输出无法被解析/校验为 stats JSON
- **THEN** 系统 SHALL 回退生成纯文本回答并正常返回 citations/evidence/confidence

### Requirement: Stats persists plain answer text and shared UI state
当 `stats` preset 生成合法的结构化结果时，系统 MUST：
- 将 `fallback_markdown` 持久化为 assistant `content`
- 通过 session `shared_state.ui` 提供图表/表格 mounts
- 不再依赖 `chat_ui_envelope_enabled` 或在 `content` 中嵌入 envelope

#### Scenario: Stats returns mounts through shared_state
- **WHEN** `stats` preset 执行完成且结构化输出校验通过
- **THEN** assistant 消息 `content` SHALL 仅包含 `fallback_markdown`
- **AND** 响应或 stream SHALL 通过 `shared_state` / `state_delta` 传递对应的 UI mounts
