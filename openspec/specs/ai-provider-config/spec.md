# ai-provider-config Specification

## Purpose
TBD - created by archiving change add-research-workspace. Update Purpose after archive.
## Requirements
### Requirement: Provider 接口
系统 SHALL 定义 Provider 接口，支持文本向量化与聊天生成。

#### Scenario: 接入 Provider
- **WHEN** Provider 实现该接口
- **THEN** 可用于索引与问答流程

### Requirement: Provider 类型配置
系统 SHALL 支持通过配置选择 OpenAI SDK 或 Ollama SDK 作为 Provider。

#### Scenario: 选择 Ollama 作为 Provider
- **WHEN** 配置中指定 Provider 为 Ollama
- **THEN** 系统使用 Ollama 完成向量化或聊天调用

### Requirement: Embedding 与 Chat 分离配置
系统 SHALL 允许分别配置 embedding provider 与 chat provider。

#### Scenario: Embedding 使用 Ollama
- **WHEN** embedding provider 设置为 Ollama
- **THEN** 文档摄取使用 Ollama 生成向量

#### Scenario: Chat 使用 OpenAI
- **WHEN** chat provider 设置为 OpenAI
- **THEN** 对话回答使用 OpenAI 生成

### Requirement: 默认嵌入模型
系统 SHALL 允许配置默认 embedding 模型，并支持 bge-m3 作为默认值。

#### Scenario: 配置默认 embedding
- **WHEN** 配置中设置 embedding_model 为 bge-m3
- **THEN** 摄取流程使用该模型生成向量

### Requirement: Plugin-based Provider Extension
系统 SHALL 支持通过插件机制注册第三方 AI provider。插件 MUST 通过 Python entry_points 被自动发现。插件注册的 provider MUST 与内置 provider 使用相同的接口。

#### Scenario: 加载第三方 AI provider 插件
- **WHEN** 安装了实现 AIProviderPlugin 接口的第三方包
- **THEN** 系统启动时自动发现并注册该 provider，可在配置文件中引用

#### Scenario: 禁用插件 provider
- **WHEN** 在配置文件中将某个插件 provider 标记为 disabled
- **THEN** 该 provider 不被加载，不出现在可用 provider 列表中

### Requirement: Model-level Completion Options
系统 SHALL 支持在 `models.available[].completion_options` 中声明 chat 生成默认参数，并在所有 chat 调用路径一致生效。

#### Scenario: completion options 生效一致
- **GIVEN** 同一个 chat 模型在配置中声明了 `completion_options.temperature`
- **WHEN** 系统分别通过 Agent 路径与 Provider 路径调用该模型
- **THEN** 两条路径 MUST 使用一致的默认 temperature（除非请求级显式覆盖）

### Requirement: Model-level Request Options
系统 SHALL 支持在 `models.available[].request_options` 中声明请求级设置（timeout/proxy/verify_ssl/headers），并在所有调用路径一致生效（对不支持的 provider 可降级忽略，但必须可观测）。

#### Scenario: request options timeout 生效
- **GIVEN** 配置中声明了 `request_options.timeout=10`
- **WHEN** 系统对该模型发起一次 LLM 请求
- **THEN** 请求 MUST 使用 10 秒超时（或等价超时语义）

#### Scenario: request options headers 生效
- **GIVEN** 配置中声明了 `request_options.headers={"X-Test":"1"}`
- **WHEN** 系统对该模型发起一次 LLM 请求
- **THEN** 请求 MUST 携带该 header（对不支持的 provider MUST 在日志中记录降级）
