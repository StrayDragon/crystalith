# source-connectors 规范增量

## ADDED Requirements

### Requirement: Connector Preflight MUST Return User-actionable Diagnostics
系统 MUST 在 binding、snapshot 或 sync_check 之前支持 connector preflight，并返回可被 UI 直接消费的 diagnostics。

#### Scenario: 创建 binding 前先做轻量预检
- **WHEN** 用户准备为某个 notebook 创建 connector binding
- **THEN** 系统 SHALL 返回 readiness、error_code、hint 与 next_action
- **AND** SHALL 在需要时标记为 `READY`、`DEGRADED` 或 `BLOCKED`

### Requirement: Sync Check MUST Use a Stable Snapshot Baseline
系统 MUST 以稳定的 snapshot baseline 驱动 sync_check，而不是临时比较不带身份的结果集。

#### Scenario: 用户复查已连接的 connector
- **WHEN** 用户对已连接 binding 发起 sync_check
- **THEN** 系统 SHALL 基于 `last_confirmed_snapshot` 或等价 baseline 生成 added/modified/deleted 候选
- **AND** SHALL 为每个候选返回 reason 字段

### Requirement: Connector Diagnostics MUST Support Safe Export
系统 MUST 支持导出 connector diagnostics 的最小诊断包，并默认对 secrets 与正文做脱敏。

#### Scenario: 用户导出 connector 现场用于排障
- **WHEN** 用户在 connector diagnostics 中触发导出
- **THEN** 系统 SHALL 返回结构稳定的最小诊断包
- **AND** SHALL 不包含 secrets 明文或大段内容正文
