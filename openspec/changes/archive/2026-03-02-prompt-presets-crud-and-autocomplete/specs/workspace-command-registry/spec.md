# workspace-command-registry Specification

## Purpose

定义前端可发现的“命令/指令” registry：客户端如何获取结构化命令定义，以驱动输入自动补全与 UI 展示，并为未来扩展更多 `/*` 命令族提供稳定接口。

## Non-goals

- 不定义具体命令的业务语义（例如 `/prompt:` 解析与 QA 行为由 `chat-prompt-presets`/`workspace-api-contract` 定义）
- 不要求客户端执行命令（仅提供发现与补全用的结构化定义）
- 不引入新的 `/v2` API

## Requirements

## ADDED Requirements

### Requirement: Commands can be listed via /v1/commands
系统 MUST 提供 `GET /v1/commands` 端点以返回命令列表，供客户端用于自动补全与提示。

#### Scenario: List commands returns a stable array
- **WHEN** 客户端请求 `GET /v1/commands`
- **THEN** 系统 SHALL 返回 JSON array
- **AND** array 中每个元素 MUST 包含最小字段：`id`, `kind`, `trigger`, `description`, `enabled`, `source`

### Requirement: Command schema supports future extensibility
`/v1/commands` 返回的命令对象 MUST 支持未来扩展更多命令族而不破坏旧客户端：

- `kind` MUST 为字符串枚举；客户端 MAY 忽略未知 `kind`
- `meta` 字段 MAY 存在且 MUST 为 JSON object

#### Scenario: Unknown kind is ignorable
- **WHEN** `GET /v1/commands` 返回包含客户端未知的 `kind`
- **THEN** 客户端 SHALL 能忽略该项并保持其它命令可用

### Requirement: Prompt preset commands are represented as triggers
当命令属于 prompt preset 时，系统 MUST 以 `trigger="/prompt:<preset>"` 表达可插入的触发串，并提供描述与启用状态。

#### Scenario: Builtin prompt preset appears in commands list
- **WHEN** 系统存在内置 preset `stats`
- **THEN** `GET /v1/commands` SHALL 至少包含一项 `kind="prompt_preset"` 且 `trigger="/prompt:stats"` 且 `source="builtin"` 且 `enabled=true`

#### Scenario: Custom prompt preset appears and reflects enabled state
- **WHEN** 用户创建了自定义 preset `demo` 且 `enabled=false`
- **THEN** `GET /v1/commands` SHALL 包含 `trigger="/prompt:demo"` 且 `source="custom"` 且 `enabled=false`

### Requirement: Commands are ordered deterministically
`GET /v1/commands` 的返回顺序 MUST 稳定（例如按 `trigger` 升序）。

#### Scenario: Stable ordering
- **WHEN** 客户端多次请求 `GET /v1/commands`
- **THEN** 返回结果的排序规则 SHALL 保持一致（不依赖 DB insertion order）
