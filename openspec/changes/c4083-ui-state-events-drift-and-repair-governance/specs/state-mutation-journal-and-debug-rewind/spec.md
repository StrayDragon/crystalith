# state-mutation-journal-and-debug-rewind 规范增量

## ADDED Requirements

### Requirement: Key UI State Changes MUST Produce a Mutation Journal
系统 MUST 为关键 UI/shared state 变化记录 mutation journal，而不是只保留当前值快照。

#### Scenario: 某个工作面状态发生变化
- **WHEN** 用户动作、系统自动过程或恢复流程改变关键状态
- **THEN** 系统 SHALL 记录对应 mutation 的来源、前后状态或差异摘要
- **AND** SHALL 能让后续诊断按时间顺序回看这些突变

### Requirement: Debug Rewind MUST Reuse Journal and Receipt Semantics
系统 MUST 让 debug rewind 建立在 mutation journal 与 UI receipts 之上，而不是另造一套调试路径。

#### Scenario: 开发者回看状态如何演化到当前值
- **WHEN** 调试界面请求 rewind 某段关键状态变更
- **THEN** 系统 SHALL 基于 journal/receipt 恢复关键步骤
- **AND** SHALL 与 shared state revision 语义保持一致
