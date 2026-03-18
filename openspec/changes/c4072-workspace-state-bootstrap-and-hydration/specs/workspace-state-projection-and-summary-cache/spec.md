# workspace-state-projection-and-summary-cache 规范增量

## ADDED Requirements

### Requirement: Workspace Projection MUST Be the Canonical Source for Shell Summaries
系统 MUST 让 workspace shell、home、cockpit 与 collection summaries 建立在统一 projection 之上。

#### Scenario: 多个入口展示同一摘要
- **WHEN** 首页、壳层角标或 collection home 需要展示同一类状态摘要
- **THEN** 系统 SHALL 复用同一 projection 字段语义
- **AND** SHALL 避免每个入口各自拼装不同说法

### Requirement: Summary Cache MUST Support Partial Refresh
系统 MUST 允许 projection/summary cache 做局部失效和局部刷新，而不是每次整页重算。

#### Scenario: 某类对象变化后仅刷新相关摘要
- **WHEN** 某个 notebook、session 或 output 状态发生变化
- **THEN** 系统 SHALL 能只刷新相关 projection 子集
- **AND** SHALL 避免无差别重算整个 workspace summary
