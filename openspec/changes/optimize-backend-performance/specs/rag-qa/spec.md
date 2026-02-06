## ADDED Requirements

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
