# command-intent-routing-permissions-and-action-composition 规范增量

## ADDED Requirements

### Requirement: Commands MUST Express Intent, Context, and Risk Explicitly
系统 MUST 让 command schema 显式表达 intent、上下文依赖与风险，而不是只暴露一个模糊按钮。

#### Scenario: 某个动作被系统或用户触发
- **WHEN** 前端或自动化层准备执行某个命令
- **THEN** 命令 SHALL 说明它需要什么 context、可能造成什么 side effects
- **AND** SHALL 能表达其 risk level 与前置条件

### Requirement: Action Composition MUST Stay Previewable and Explainable
系统 MUST 让多步动作组合保持可预览和可解释，而不是把几个副作用偷偷绑在一起执行。

#### Scenario: 一个高阶命令会串起多个动作
- **WHEN** 系统将多个基础动作收成一个 command flow
- **THEN** 用户 SHALL 能看到将要发生的关键步骤
- **AND** 失败时 SHALL 能解释是哪一步出错及如何恢复
