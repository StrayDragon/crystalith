# rag-qa Specification

## Purpose
TBD - created by archiving change add-research-workspace. Update Purpose after archive.
## Requirements
### Requirement: 基于检索的回答
系统 SHALL 仅基于当前 Notebook 内已索引的来源回答问题。

#### Scenario: 有相关来源的提问
- **WHEN** 用户在 Notebook 中提问且存在相关来源
- **THEN** 系统返回基于这些来源的答案

### Requirement: 内联引用
系统 SHALL 在回答中提供引用信息，指向来源名称与对应片段。

#### Scenario: 提供引用
- **WHEN** 系统生成回答
- **THEN** 返回结果包含引用与来源片段信息

### Requirement: 无证据提示
系统 SHALL 在缺少证据时明确提示无法回答。

#### Scenario: 无相关来源的提问
- **WHEN** 用户提问但未检索到高于阈值的来源
- **THEN** 系统提示缺乏足够信息

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
