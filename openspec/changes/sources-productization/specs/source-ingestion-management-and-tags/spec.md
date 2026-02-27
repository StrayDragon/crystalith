## ADDED Requirements

### Requirement: Source failures include diagnostic fields
来源在失败或不可恢复状态下 MUST 提供结构化诊断信息，以支持 UI 给出可操作的修复建议。

#### Scenario: Source ingestion fails with stable error_code
- **WHEN** 某来源导入/解析/索引失败并进入 FAILED 状态
- **THEN** 系统 SHALL 返回稳定的 `error_code`
- **AND** 可选返回 `error_message` 与 `recovery_hint`
- **AND** 字段语义 SHALL 可被 UI 直接展示而无需解析异常栈

### Requirement: Batch operations return per-item results and keep epoch consistent
批量删除、批量 re-embed 与 tag 绑定/解绑 MUST 返回逐项结果并保持 `sources_epoch` 失效语义可预测。

#### Scenario: Batch delete returns partial failures
- **WHEN** 用户发起批量删除且其中部分来源不可删除或不存在
- **THEN** 系统 SHALL 返回逐项成功/失败结果
- **AND** 成功项对应的存储与 epoch 失效 SHALL 发生
- **AND** 失败项 MUST 返回稳定错误码以便 UI 呈现

### Requirement: Optional source dedup does not silently drop data
系统 MAY 支持来源去重，但在命中去重时 MUST 不得静默丢弃用户导入请求。

#### Scenario: Dedup hit requires explicit user choice
- **WHEN** 系统检测到新导入来源与既有来源 dedup_key 冲突
- **THEN** 系统 SHALL 提供“复用既有来源”或“仍创建新来源”的明确选择（或等价机制）
