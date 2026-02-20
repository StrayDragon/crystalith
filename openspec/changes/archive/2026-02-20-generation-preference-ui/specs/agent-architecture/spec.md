## ADDED Requirements

### Requirement: OutputGraph supports generation preference
系统 MUST 支持在 OutputGraph 执行时提供可选的 `preference`，并将其影响应用到 ResolveContext（检索参数）与 GenerateOutput（重试策略）。

#### Scenario: preference 影响检索与重试
- **WHEN** OutputGraph 以 `preference = speed` 运行
- **THEN** ResolveContext 使用 speed 对应的检索调参（例如更小 top_k、更高 min_score）
- **AND** GenerateOutput 使用 speed 对应的重试次数

### Requirement: Explicit retrieval params override preference in OutputGraph
系统 MUST 保证显式传入的 `top_k/min_score` 优先于 `preference` 的默认调参。

#### Scenario: 显式参数优先生效
- **WHEN** OutputGraph 以 `preference = quality` 运行
- **AND** 同时显式传入 `top_k/min_score`
- **THEN** ResolveContext 使用显式 `top_k/min_score`
