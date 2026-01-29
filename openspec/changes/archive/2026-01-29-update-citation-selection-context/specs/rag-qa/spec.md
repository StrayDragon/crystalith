## ADDED Requirements
### Requirement: 显式引用范围问答
系统 MUST 支持在 QA 请求中提供选中引用的 `chunk_ids`，并仅使用这些引用构建回答上下文。

#### Scenario: 使用显式引用回答
- **WHEN** 客户端提供 `chunk_ids`
- **THEN** 系统跳过向量检索，仅使用这些 chunk 构建上下文与引用
- **AND** 返回的 citations 仅包含这些 chunk

#### Scenario: 无效引用范围
- **WHEN** 提供的 `chunk_ids` 不属于当前 notebook 或引用不可用
- **THEN** 系统返回 400 并说明无效引用范围
