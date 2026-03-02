## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Unknown preset names are rejected with a stable list
系统 MUST 将 preset 集合视为白名单（built-in + custom）。未知 preset MUST 被拒绝并返回可用 preset 列表。

#### Scenario: Unknown preset is rejected
- **WHEN** `question` 为 `/prompt:unknown do something` 且 presets 功能已启用
- **THEN** 系统 SHALL 返回 400 并包含可用 preset 名称列表（包含 built-in 与 custom）
