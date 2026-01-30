## RENAMED Requirements
- FROM: `### Requirement: 显式引用范围问答`
- TO: `### Requirement: 显式来源范围问答`

## MODIFIED Requirements
### Requirement: 显式来源范围问答
系统 MUST 支持在 QA 请求中提供选中来源的 `source_ids`，并仅使用这些来源检索并构建回答上下文。

#### Scenario: 使用显式来源回答
- **WHEN** 客户端提供 `source_ids`
- **THEN** 系统仅从这些来源检索上下文并生成回答
- **AND** 返回的 citations 仅来自这些来源

#### Scenario: 空来源范围
- **WHEN** 客户端未提供 `source_ids` 或 `source_ids` 为空
- **THEN** 系统不执行检索并返回无证据提示
- **AND** citations 为空或 evidence=false

#### Scenario: 无效来源范围
- **WHEN** `source_ids` 包含不属于当前 notebook 的来源
- **THEN** 系统返回 400 并说明无效来源范围
