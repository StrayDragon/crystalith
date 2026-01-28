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
