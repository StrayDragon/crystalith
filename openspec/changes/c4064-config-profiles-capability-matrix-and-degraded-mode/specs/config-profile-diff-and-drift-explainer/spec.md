# config-profile-diff-and-drift-explainer 规范增量

## ADDED Requirements

### Requirement: Config Diff MUST Distinguish Static and Runtime-derived Differences
系统 MUST 区分静态配置差异与运行时推导差异，避免把 overlay/env/file 问题与 readiness/probe 问题混为一谈。

#### Scenario: 对比两个 profile 的差异
- **WHEN** 用户比较两个 profile 或两份配置
- **THEN** 系统 SHALL 分别输出静态配置差异与运行时推导差异
- **AND** SHALL 指出哪些差异会影响 capability matrix

### Requirement: Effective Config Output MUST Be Redacted and Reviewable
系统 MUST 提供可审查的 effective config 输出，但默认进行敏感字段脱敏。

#### Scenario: 开发者查看当前生效配置
- **WHEN** 开发者请求 effective config
- **THEN** 系统 SHALL 返回稳定字段形状的 redacted config
- **AND** SHALL 不暴露 secret 明文

### Requirement: Drift Explanations MUST Be User-actionable
系统 MUST 为配置漂移或默认值风险提供可执行解释，而不是只给底层校验错误。

#### Scenario: 配置漂移导致能力变化
- **WHEN** 某项配置变化使能力边界发生变化
- **THEN** 系统 SHALL 返回影响说明、reason_code 与 next_action
- **AND** SHALL 能引用 rationale 或 safe-default audit 结果
