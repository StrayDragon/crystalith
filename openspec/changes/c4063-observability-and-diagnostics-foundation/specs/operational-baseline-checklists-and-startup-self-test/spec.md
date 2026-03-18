# operational-baseline-checklists-and-startup-self-test 规范增量

## ADDED Requirements

### Requirement: Startup Self-test MUST Return Actionable Guidance
系统 MUST 将启动自检结果表达为可执行建议，而不是只返回被动状态列表。

#### Scenario: 进入工作前执行自检
- **WHEN** 系统或用户触发 startup self-test
- **THEN** 系统 SHALL 返回关键检查结果与下一步动作
- **AND** SHALL 避免要求用户手动解析低层诊断细节

### Requirement: Workspace Health MUST Surface Decay Signals
系统 MUST 支持轻量工作区健康信号，并突出持续恶化的 decay signals。

#### Scenario: 某类问题持续积压
- **WHEN** 来源陈旧、草稿堆积或本地膨胀持续恶化
- **THEN** 系统 SHALL 将其标记为 decay signal
- **AND** SHALL 提供至少一个低风险处理入口

### Requirement: Repair Suggestions MUST Be Batchable and Reversible
系统 MUST 将常见低风险修复动作组织成可批量执行且可回滚的 repair flow。

#### Scenario: 用户处理一组低风险问题
- **WHEN** 用户接受一批 repair suggestions
- **THEN** 系统 SHALL 允许按批次执行这些修复
- **AND** SHALL 说明回滚边界或确认不可回滚项
