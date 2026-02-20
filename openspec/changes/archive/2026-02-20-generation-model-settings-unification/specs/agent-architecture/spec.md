## ADDED Requirements

### Requirement: Consistent Model Settings Application
系统 MUST 在所有基于 `pydantic_ai.Agent` 的生成路径中一致应用来自配置的模型请求设置（completion options + request options），并在日志中记录 effective settings。

#### Scenario: OutputGraph 应用 completion options
- **GIVEN** 配置为默认 chat 模型设置了 `completion_options.temperature` 与 `completion_options.max_tokens`
- **WHEN** 系统通过 OutputGraph 生成结构化输出
- **THEN** LLM 请求 MUST 使用该 temperature/max_tokens 作为默认生成参数
- **AND** 日志 MUST 记录本次生成的 effective completion options

#### Scenario: OutputGraph 应用 request options
- **GIVEN** 配置为默认 chat 模型设置了 `request_options.timeout` 与自定义 headers
- **WHEN** 系统通过 OutputGraph 调用 LLM
- **THEN** LLM 请求 MUST 使用该 timeout 与 headers

### Requirement: No Nested Provider Retries
系统 MUST 避免在 Agent 路径中出现“SDK 内置重试 + 业务层重试”的嵌套行为。系统 SHOULD 将网络/限流类错误的重试边界统一到业务层策略中。

#### Scenario: 禁用 SDK 内置重试
- **WHEN** 系统构建用于 Agent 的 OpenAI-compatible client
- **THEN** SDK 的内置重试 MUST 被禁用（或设置为 0）
