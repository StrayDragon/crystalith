# session-handoff-and-return-points 规范增量

## ADDED Requirements

### Requirement: Home MUST Prioritize Continue-work and Deferred-review Signals
系统 MUST 在首页优先呈现 continue-work、return points 与 deferred review 信号，而不是把这些信息分散埋入多个低优先级区域。

#### Scenario: 用户回到首页准备继续工作
- **WHEN** 用户打开首页
- **THEN** 系统 SHALL 优先展示最相关的 return point、deferred item 或 work queue 入口
- **AND** SHALL 允许用户快速继续、延后或归档

### Requirement: Daily Review MUST Resurface Deferred Work Without Becoming a PM System
系统 MUST 支持 daily review 与 resurfacing，但不能把个人工作台扩展成沉重的项目管理系统。

#### Scenario: 每日回看延后项
- **WHEN** 用户进入每日回看视图
- **THEN** 系统 SHALL 聚合延后项、未完成输出、待补证据或待整理来源
- **AND** SHALL 提供轻量继续/再次延后/归档动作

### Requirement: Work Queues MUST Accept Multiple Object Types
系统 MUST 让 personal work queues / review buckets 承接多种对象类型，而不是只支持单一任务对象。

#### Scenario: 用户把不同对象放入工作桶
- **WHEN** 用户将来源、输出、scratchpad 或 return point 放入 work queue
- **THEN** 系统 SHALL 以统一方式记录其所在 work bucket
- **AND** SHALL 支持对象在不同 buckets 之间流转
