# knowledge-curation-and-freshness 规范增量

## ADDED Requirements

### Requirement: 来源对象必须暴露 freshness 信号
系统 MUST 为接入后的来源对象提供 freshness 信号，以支持长期维护。

#### Scenario: 用户查看某个来源是否过旧
- **WHEN** 用户查看已接入的来源对象
- **THEN** 系统 SHALL 能返回该对象的 freshness 状态或提示
- **AND** freshness SHALL 表达维护信号，而不是内容真伪判断

### Requirement: 系统必须提供重复候选而不是自动合并
系统 MUST 以候选形式呈现重复内容判断，而不是直接自动合并对象。

#### Scenario: 系统发现高相似来源
- **WHEN** 系统识别出可能重复的来源对象
- **THEN** 系统 SHALL 返回 duplicate candidates
- **AND** SHALL 提供结构化比较信息与建议动作
- **AND** SHALL NOT 在未确认前自动合并或删除对象

### Requirement: 维护建议必须显式触发后续动作
系统 MUST 将维护建议与后续动作解耦，避免治理信号直接隐式改写来源状态。

#### Scenario: 用户处理维护建议
- **WHEN** 用户收到某个来源的维护建议
- **THEN** 系统 SHALL 明确该建议对应的可选动作
- **AND** 只有在用户显式触发后才执行重新导入、重新嵌入或忽略操作
