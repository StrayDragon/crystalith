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

### Requirement: 显式引用范围问答
系统 MUST 支持在 QA 请求中提供选中引用的 `chunk_ids`，并仅使用这些引用构建回答上下文。

#### Scenario: 使用显式引用回答
- **WHEN** 客户端提供 `chunk_ids`
- **THEN** 系统跳过向量检索，仅使用这些 chunk 构建上下文与引用
- **AND** 返回的 citations 仅包含这些 chunk

#### Scenario: 无效引用范围
- **WHEN** 提供的 `chunk_ids` 不属于当前 notebook 或引用不可用
- **THEN** 系统返回 400 并说明无效引用范围
