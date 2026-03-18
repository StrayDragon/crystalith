# first-run-success-path 规范增量

## ADDED Requirements

### Requirement: First-run Guidance MUST Reuse the Same Object and Readiness Semantics
系统 MUST 让首次成功路径复用统一 object/readiness 语义，而不是临时再造 onboarding 状态机。

#### Scenario: 新用户第一次进入 workspace
- **WHEN** 用户还未完成导入资料、启动会话或生成首个结果
- **THEN** 系统 SHALL 使用统一对象状态解释当前所处阶段
- **AND** SHALL 提供可恢复的 onboarding progress

### Requirement: First-run Flow MUST Keep a Recoverable Continuation Point
系统 MUST 让首次路径在中断后可恢复，而不是要求用户每次重新理解产品结构。

#### Scenario: 用户半途离开后再次回来
- **WHEN** 用户重新进入 workspace
- **THEN** 系统 SHALL 恢复其 first-run progress
- **AND** SHALL 指向最值得继续的下一步动作
