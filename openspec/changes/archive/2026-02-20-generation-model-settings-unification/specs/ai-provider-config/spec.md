## ADDED Requirements

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
