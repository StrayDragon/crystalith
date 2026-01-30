## RENAMED Requirements
- FROM: `### Requirement: 选中引用限定输出范围`
- TO: `### Requirement: 选中来源限定输出范围`

## MODIFIED Requirements
### Requirement: 选中来源限定输出范围
系统 MUST 在生成提炼/Studio 输出时优先使用选中来源的 `source_ids` 作为上下文范围。

#### Scenario: 有选中来源
- **WHEN** 用户选中来源并触发输出生成
- **THEN** 系统仅使用选中来源作为上下文
- **AND** 输出记录保存所用的 resolved chunk_ids（由后端解析）

#### Scenario: 未选中来源
- **WHEN** 用户未选中任何来源触发输出生成
- **THEN** 系统以空上下文生成输出且不执行自动检索
- **AND** 输出记录的 chunk_ids 为空
