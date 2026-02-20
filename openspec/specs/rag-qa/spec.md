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

### Requirement: RAG 管道并行化
系统 MUST 在 RAG Q&A 流程中将无依赖的操作并行执行，减少端到端延迟。

#### Scenario: 问题嵌入与历史获取并行
- **WHEN** 用户发送带有 session_id 的问题
- **THEN** 系统并行执行问题嵌入和会话历史获取
- **AND** 两者均完成后再进行向量搜索

#### Scenario: 无会话历史时直接嵌入
- **WHEN** 用户发送不带 session_id 的问题
- **THEN** 系统仅执行问题嵌入
- **AND** 不因缺少并行对象而引入额外延迟

### Requirement: AI Provider 超时与重试
系统 MUST 为 AI provider 调用配置可选的超时和重试策略，提升外部服务不稳定时的可用性。

#### Scenario: AI 调用超时
- **WHEN** AI provider 调用在配置的超时时间内未返回
- **THEN** 系统取消该调用并触发重试
- **AND** 重试间隔按指数退避增长

#### Scenario: AI 调用限流
- **WHEN** AI provider 返回限流错误（429）
- **THEN** 系统按指数退避策略重试
- **AND** 达到最大重试次数后返回错误

#### Scenario: 重试次数用尽
- **WHEN** 重试次数达到配置的最大值
- **THEN** 系统返回最后一次错误
- **AND** 记录完整的重试日志

### Requirement: OutputType-aware Query Seeds
系统 SHOULD 基于 `OutputType` 为 multi-query 生成额外的 query seeds/hints，以提高检索覆盖稳定性。

#### Scenario: Timeline seeds 更关注日期/事件
- **GIVEN** output_type 为 TIMELINE 且启用 multi-query
- **WHEN** 系统生成 query seeds
- **THEN** seeds SHOULD 包含与日期/事件抽取相关的提示（在不泄露实现细节的前提下）

#### Scenario: Seeds 数量受上限控制
- **WHEN** multi-query 启用
- **THEN** 系统 MUST 将 seeds 数量限制在可配置/可调的上限内
