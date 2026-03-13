# structural-refinement-for-generated-results 规范增量

## ADDED Requirements

### Requirement: 结果必须暴露可被改良的结构单元
系统 MUST 为生成结果暴露可识别的结构单元，以支持后续 refinement。

#### Scenario: 用户查看可改良结果
- **WHEN** 用户打开一个支持 refinement 的结果
- **THEN** 系统 SHALL 能标识可被操作的结构单元
- **AND** 这些结构单元 SHALL 成为局部改良的作用范围

### Requirement: 系统必须支持局部 refinement 动作
系统 MUST 允许基于已有结果上下文执行局部改良动作，而不是只能整篇重生成。

#### Scenario: 用户只重写结果中的一个部分
- **WHEN** 用户对某个结构单元发起改良请求
- **THEN** 系统 SHALL 仅对该作用范围执行 refinement
- **AND** 未被改动的部分 SHALL 保持稳定

### Requirement: 局部 refinement 与整篇重生成必须有清楚边界
系统 MUST 明确哪些改良请求适合局部完成，哪些必须回到整篇重生成路径。

#### Scenario: 某个改良请求超出局部边界
- **WHEN** 用户请求的改动超出单个结构单元可承载范围
- **THEN** 系统 SHALL 引导其进入整篇重生成或更高层改写流程
- **AND** SHALL NOT 伪装成局部 refinement 成功完成

### Requirement: 局部改良请求必须显式表达变更范围与操作类型
系统 MUST 在局部改良请求中显式表达“作用范围（scope）”与“操作类型（local refinement vs full regeneration）”，避免 API/UI 混淆。

#### Scenario: 用户对某个结构单元发起局部改良
- **WHEN** 用户对某个结构单元发起改良
- **THEN** 系统 SHALL 在请求中显式携带作用范围（至少包含目标 unit_id 与动作）
- **AND** 系统 SHALL 显式标识该操作是局部改良

### Requirement: 局部改良必须保留未改动部分并记录改良历史
系统 MUST 在局部改良写回时保留未改动部分的内容稳定，并记录改良动作、范围与时间线，以支持持续打磨与可追溯性。

#### Scenario: 用户对结果的一个部分进行改良并应用
- **WHEN** 用户对某个结构单元应用局部改良
- **THEN** 系统 SHALL 仅更新该作用范围内的内容
- **AND** 未被作用范围覆盖的部分 SHALL 保持不变
- **AND** 系统 SHALL 记录一条改良历史记录（包含动作与 scope）
