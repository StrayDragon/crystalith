## ADDED Requirements
### Requirement: 搜索结果摘要消息
系统 **MUST** 在搜索响应中返回由摘要生成流程产生的 message，用于描述搜索结果与下一步建议。

#### Scenario: 返回摘要消息
- **WHEN** 搜索摘要生成成功
- **THEN** 搜索响应的 message 字段包含摘要与下一步提示
- **AND** message 不使用占位或 TODO 文本

#### Scenario: 摘要生成失败
- **WHEN** 搜索摘要生成失败或不可用
- **THEN** 搜索响应的 message 字段为空字符串
- **AND** 仍返回真实的搜索结果列表
