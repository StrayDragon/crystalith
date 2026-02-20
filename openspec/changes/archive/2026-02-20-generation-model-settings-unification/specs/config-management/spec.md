## ADDED Requirements

### Requirement: Model Settings Resolution Priority
系统 MUST 定义并遵循统一的模型请求设置优先级：请求级显式覆盖 > model-level 配置 > 全局默认 > 库默认。

#### Scenario: 显式覆盖优先
- **GIVEN** 配置中为模型设置了 `completion_options.temperature=0.7`
- **WHEN** 调用方以显式参数覆盖 temperature（如未来引入的 request override，或内部调用覆盖）
- **THEN** 系统 MUST 使用显式覆盖值而非配置默认值

#### Scenario: model-level 覆盖全局默认
- **GIVEN** 全局 `ai.timeout=60`
- **AND** 某 chat 模型声明 `request_options.timeout=15`
- **WHEN** 系统调用该 chat 模型
- **THEN** 系统 MUST 使用 15 秒作为请求超时
