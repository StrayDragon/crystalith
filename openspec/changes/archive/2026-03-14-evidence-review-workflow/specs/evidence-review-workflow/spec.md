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

### Requirement: 审阅记录必须关联到结果与 citation/evidence 对象
系统 MUST 让 evidence review 记录能够关联到被审阅的结果对象以及其 citation/evidence 上下文，以支持逐条核查与可追溯性。

#### Scenario: 审阅者标记某条 citation 需修订
- **WHEN** 审阅者对某条 citation 标记为需修订
- **THEN** 系统 SHALL 记录该 citation 的审阅状态
- **AND** SHALL 将该记录关联到对应结果与 citation 标识

### Requirement: 结果对象必须暴露 evidence review 摘要以支持列表与详情展示
系统 MUST 在结果对象中暴露 evidence review 的摘要字段（状态与计数），以支持工作区列表与结果页一致展示。

#### Scenario: 用户在结果列表查看审阅状态
- **WHEN** 用户在工作区查看结果列表或详情
- **THEN** 系统 SHALL 返回该结果的 evidence review 状态摘要
- **AND** 用户 SHALL 能识别该结果是否待审、已审或需修订

### Requirement: 工作区必须提供进入 evidence review 的稳定入口
系统 MUST 在工作区为结果提供稳定的 evidence review 入口，避免审阅能力变成零散不可发现的隐藏功能。

#### Scenario: 用户从结果页进入证据审阅
- **WHEN** 用户打开某个结果
- **THEN** 用户 SHALL 能进入 evidence review 流程并查看 citation 级状态与 review notes
