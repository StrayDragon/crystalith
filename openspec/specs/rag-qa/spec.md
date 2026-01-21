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

