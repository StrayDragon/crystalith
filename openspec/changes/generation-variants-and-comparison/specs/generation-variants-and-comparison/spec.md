# generation-variants-and-comparison 规范增量

## ADDED Requirements

### Requirement: 系统必须支持在同一生成意图下生成多个 variant
系统 MUST 支持在同一生成类型与共享上下文下生成多个可比较候选结果。

#### Scenario: 用户请求多个候选结果
- **WHEN** 用户在适用场景下启用 variant 生成
- **THEN** 系统 SHALL 在同一生成意图下返回多个候选结果
- **AND** 这些候选 SHALL 共享同一类型与上下文边界

### Requirement: 系统必须提供结构化比较信息
系统 MUST 为多个 variant 提供结构化比较信息，以帮助用户完成选择。

#### Scenario: 用户比较多个候选结果
- **WHEN** 用户查看一个 variant 集合
- **THEN** 系统 SHALL 提供每个候选的结构化比较元数据
- **AND** SHALL 支持在候选之间切换和查看差异焦点

### Requirement: 用户必须能够选定工作结果
系统 MUST 允许用户从 variant 集合中显式选定一个工作结果，而不是让所有候选长期并列悬空。

#### Scenario: 用户确认其中一个 variant
- **WHEN** 用户选定一个候选结果
- **THEN** 系统 SHALL 记录该选定动作
- **AND** 被选定结果 SHALL 成为后续继续工作的主结果
