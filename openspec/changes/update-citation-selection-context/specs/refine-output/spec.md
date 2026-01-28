## ADDED Requirements
### Requirement: 选中引用限定输出范围
系统 MUST 在生成提炼/Studio 输出时优先使用选中引用的 chunk_ids 作为上下文。

#### Scenario: 有选中引用
- **WHEN** 用户选中引用并触发输出生成
- **THEN** 系统仅使用选中引用作为上下文
- **AND** 输出记录保存所用的 chunk_ids

#### Scenario: 未选中引用
- **WHEN** 用户未选中引用触发输出生成
- **THEN** 系统使用默认的 notebook 检索上下文
