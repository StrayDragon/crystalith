# ui-contract-golden-recordings-and-drift-alerts 规范增量

## ADDED Requirements

### Requirement: Critical UI Surfaces MUST Have Contract Goldens
系统 MUST 为关键 UI surfaces 维护 contract goldens，而不是只依赖手工记忆判断结构是否漂移。

#### Scenario: 重构影响关键工作面
- **WHEN** 某次变更触及关键视图结构、关键载荷或关键交互状态
- **THEN** 系统 SHALL 能与对应 golden baseline 做比较
- **AND** SHALL 在出现异常漂移时生成明确 alert

### Requirement: Drift Alerts MUST Point to Reviewable Contract Deltas
系统 MUST 让 drift alerts 指向可复核的 contract delta，而不是只给出模糊“变了”的提示。

#### Scenario: 某个关键工作面与 baseline 不一致
- **WHEN** golden comparison 检测到 drift
- **THEN** 系统 SHALL 提供足够的 delta 摘要供 review
- **AND** SHALL 能与 state/schema ownership 信息联动
