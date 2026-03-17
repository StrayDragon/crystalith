# source-readiness-and-freshness 规范增量

## ADDED Requirements

### Requirement: Readiness Signals MUST Cover Source, Pack, and Watcher Layers
系统 MUST 为 `source`、`source_pack` 与 `watcher` 三层对象返回统一可解释的 readiness/freshness 信号，而不是只覆盖单条来源。

#### Scenario: 用户查看来源包是否适合继续使用
- **WHEN** 用户打开某个 `source_pack`
- **THEN** 系统 SHALL 返回该来源包的 readiness、freshness、异常提示与下一步动作
- **AND** 这些信号 SHALL 能追溯到来源成员或监测状态摘要

### Requirement: Refresh Policy MUST Be User-visible and Overridable
系统 MUST 将 refresh policy profile 作为用户可见对象返回，并支持人工覆盖。

#### Scenario: 用户查看某条来源为什么会自动复查
- **WHEN** 用户查看某个来源或来源包的刷新策略
- **THEN** 系统 SHALL 返回当前 policy profile、自动复查方式与选择原因
- **AND** SHALL 指明该策略是否来自默认规则还是人工覆盖

### Requirement: Refresh Suggestions MUST Stay Explicit
系统 MUST 将“建议刷新/建议复查/建议谨慎使用”等维护信号与实际执行动作分离。

#### Scenario: 系统建议复查但未直接执行
- **WHEN** 某条来源 freshness 下降或监测器发现异常
- **THEN** 系统 SHALL 返回明确建议动作
- **AND** SHALL NOT 在未满足既定自动复查条件时隐式改写来源状态
