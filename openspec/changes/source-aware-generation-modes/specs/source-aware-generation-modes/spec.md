# source-aware-generation-modes 规范增量

## ADDED Requirements

### Requirement: 生成类型必须能够声明来源使用模式
系统 MUST 允许生成类型声明其来源使用模式，以表达不同的来源依赖预期。

#### Scenario: 某个生成类型需要严格来源约束
- **WHEN** 系统注册一种需要强证据支持的生成类型
- **THEN** 该类型 SHALL 能声明对应的来源使用模式
- **AND** 该模式 SHALL 成为后续生成装配的一部分

### Requirement: 来源模式必须影响 citation 与来源展示预期
系统 MUST 让来源模式影响 citation 行为和来源展示边界，而不是只作为内部策略标签存在。

#### Scenario: 用户查看不同来源模式的结果
- **WHEN** 两个结果采用不同来源使用模式
- **THEN** 系统 SHALL 能在 citation 预期或来源展示上体现差异
- **AND** 用户 SHALL 能理解当前结果对来源的依赖方式

### Requirement: 来源模式不得反向重写上游对象模型
系统 MUST 将来源模式建立在稳定的生成类型和来源对象语义之上，而不是借此重写上游定义。

#### Scenario: 为某个类型新增来源模式
- **WHEN** 系统新增或调整某个来源模式
- **THEN** 该变更 SHALL 消费既有类型与来源对象模型
- **AND** SHALL NOT 反向定义新的类型或接入基础语义
