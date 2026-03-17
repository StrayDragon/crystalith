# workspace-object-model-and-readiness-contract 规范增量

## ADDED Requirements

### Requirement: Workspace Core Objects MUST Share a Stable Domain Model
系统 MUST 为 workspace 核心对象提供稳定的 domain model，而不是让不同面板和接口各自解释对象边界。

#### Scenario: 前后端同时消费 notebook、source、session 或 output
- **WHEN** 不同子系统读取同一类核心对象
- **THEN** 系统 SHALL 复用统一的 object identity、字段命名与关系语义
- **AND** SHALL 避免为同一对象维护多套不兼容表示

### Requirement: Readiness States MUST Carry Next-step Semantics
系统 MUST 让 readiness 状态直接指向下一步动作，而不是只暴露一个被动标签。

#### Scenario: 某个对象处于 blocked 或 degraded 状态
- **WHEN** 用户或系统查看该对象的当前状态
- **THEN** 系统 SHALL 说明该状态代表什么
- **AND** SHALL 提供与之对应的恢复、继续或升级路径
