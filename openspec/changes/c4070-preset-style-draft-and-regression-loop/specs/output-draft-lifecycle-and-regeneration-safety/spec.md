# output-draft-lifecycle-and-regeneration-safety 规范增量

## ADDED Requirements

### Requirement: Draft Regeneration MUST Respect Locks and Review Boundaries
系统 MUST 让 regeneration 尊重 section locks、review 状态与确认边界。

#### Scenario: 用户只重生成未锁定片段
- **WHEN** 用户对带 section locks 的输出执行局部重生成
- **THEN** 系统 SHALL 仅修改未锁定范围或明确选中的区段
- **AND** SHALL 提示预估影响范围

### Requirement: Output Diffs MUST Include Structural and Citation Context
系统 MUST 在 output diff 中同时表达结构差异、文本差异与引用/背景差异。

#### Scenario: 用户复核一次变更
- **WHEN** 用户查看两个输出版本的差异
- **THEN** 系统 SHALL 能显示结构、文本与引用背景的差异摘要
- **AND** SHALL 支持将该差异纳入 draft review 流程

### Requirement: Style-driven Changes MUST Not Bypass Draft Safety
系统 MUST 让由 template/style/preset 引发的结构或表达变化同样经过 draft safety，而不是直接覆盖已确认内容。

#### Scenario: 调整模板后重新生成
- **WHEN** 用户修改 output template 或 section style 后触发重生成
- **THEN** 系统 SHALL 通过同一套 draft/replace/review 边界处理该变化
- **AND** SHALL 不静默覆盖已冻结内容
