# typed-generation-framework 规范增量

## ADDED Requirements

### Requirement: 生成请求必须显式绑定生成类型
系统 MUST 将生成类型作为显式的一等对象，而不是隐含在 prompt 或入口按钮中。

#### Scenario: 用户发起某一类生成
- **WHEN** 用户发起一次生成请求
- **THEN** 该请求 SHALL 显式指向一个生成类型
- **AND** 系统 SHALL 基于该类型装配对应契约

### Requirement: 生成类型必须声明最小类型契约
系统 MUST 为每种生成类型声明最小契约，以支撑后续控制项、结果结构和完成语义。

#### Scenario: 系统注册一个生成类型
- **WHEN** 系统新增或加载某个生成类型
- **THEN** 该类型 SHALL 至少声明输入要求、输出结构、控制面与完成语义
- **AND** 这些字段 SHALL 使用公共框架词汇表达

### Requirement: 生成类型与输出类型必须保持边界分离
系统 MUST 保持生成类型与输出类型的边界清晰，避免一个概念吞掉另一个概念。

#### Scenario: 结果被渲染为某种输出形式
- **WHEN** 某个生成结果被渲染或承载
- **THEN** 系统 SHALL 能区分其生成类型与输出类型
- **AND** 输出类型 SHALL NOT 反向重写生成类型定义
