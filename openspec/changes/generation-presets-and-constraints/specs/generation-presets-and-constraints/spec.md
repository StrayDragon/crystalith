# generation-presets-and-constraints 规范增量

## ADDED Requirements

### Requirement: 生成类型必须支持显式预设选择
系统 MUST 允许每种生成类型声明并选择显式预设，以帮助用户稳定启动高价值生成路径。

#### Scenario: 用户选择某类生成的预设
- **WHEN** 用户准备发起某个生成类型
- **THEN** 系统 SHALL 展示该类型可用的预设
- **AND** 预设 SHALL 使用公共类型词汇解释其作用

### Requirement: 生成请求必须支持显式约束覆盖
系统 MUST 允许用户在允许范围内覆盖生成约束，而不是只能依赖隐式默认值。

#### Scenario: 用户调整生成约束
- **WHEN** 用户选择某个预设后继续调整长度或证据要求
- **THEN** 系统 SHALL 接收结构化约束覆盖
- **AND** 这些覆盖 SHALL 受该类型允许的控制面约束

### Requirement: 预设与约束不得反向定义生成类型
系统 MUST 保持预设与约束处于“可控生成”层，而不是重写生成类型本身。

#### Scenario: 新增某个生成类型的预设
- **WHEN** 系统为一种已有生成类型新增预设
- **THEN** 该变更 SHALL 建立在既有类型契约之上
- **AND** SHALL NOT 借由预设定义新的类型公共术语
