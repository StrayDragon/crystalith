# evidence-review-workflow 规范增量

## ADDED Requirements

### Requirement: 结果必须具备独立的 evidence review 状态
系统 MUST 为结果提供独立于生成成功状态的 evidence review 状态。

#### Scenario: 结果已生成但尚未审阅
- **WHEN** 一个结果已经生成完成
- **THEN** 系统 SHALL 允许该结果处于未审阅状态
- **AND** 该状态 SHALL 与生成成功状态分离表示

### Requirement: 审阅流程必须记录 review note 与证据关系
系统 MUST 在审阅流程中记录 review note 以及与 citation / evidence 的关系。

#### Scenario: 审阅者标记需要修订
- **WHEN** 审阅者对某个结果提出修订意见
- **THEN** 系统 SHALL 保存结构化 review note
- **AND** review note SHALL 能关联到相关证据或 citation 上下文

### Requirement: 审阅状态转移必须由显式动作触发
系统 MUST 以显式动作驱动审阅状态转移，而不是隐式自动批准。

#### Scenario: 审阅者确认结果通过
- **WHEN** 审阅者执行通过或需修订动作
- **THEN** 系统 SHALL 更新 evidence review 状态
- **AND** SHALL 记录是谁在什么上下文下完成该动作
