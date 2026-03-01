# chat-prompt-presets Specification

## Purpose

定义 Chat 输入中的 `/prompt:*` 指令与后端 preset registry 的稳定行为：如何解析指令、如何选择生成策略，以及各 preset 的最小输出契约（包含纯文本回退与可选的 UI envelope）。

## Non-goals

- 不支持用户自定义 preset（仅内置白名单）
- 不引入新的 `/v2` API 或新增 QA request 字段（指令内嵌在 `question: string`）
- 不要求引入 Tambo threads 或 Tambo 服务端能力（仅展示侧组件渲染）

## Requirements

## ADDED Requirements

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
系统 MUST 将 preset 集合视为白名单。未知 preset MUST 被拒绝并返回可用 preset 列表。

#### Scenario: Unknown preset is rejected
- **WHEN** `question` 为 `/prompt:unknown do something` 且 presets 功能已启用
- **THEN** 系统 SHALL 返回 400 并包含可用 preset 名称列表

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

### Requirement: Stats can optionally embed a UI envelope in assistant content
当 `app.features.chat_ui_envelope_enabled=true` 时，系统 MUST 将 stats 结果持久化为“可读回退 + UI envelope”：

`<fallback_text> + "\\n\\n[[crystalith-ui:v1]]\\n" + <json_envelope>`

其中：
- `<fallback_text>` MUST 等于 stats JSON 的 `fallback_markdown`
- `<json_envelope>` MUST 为 JSON object，且 MUST 包含：
  - `schema = "crystalith.ui.message.v1"`
  - `parts`（至少包含一个 `component` part，用于渲染 `BarChartCard`）

#### Scenario: Envelope is appended only when enabled
- **WHEN** `stats` preset 执行完成且 `app.features.chat_ui_envelope_enabled=false`
- **THEN** assistant 消息 `content` SHALL 仅包含 `fallback_text`（不应追加 delimiter 与 JSON）
