## ADDED Requirements

### Requirement: OutputType-based Default Tuning
系统 MUST 能基于 `OutputType + GenerationPreference` 选择默认 tuning，并在调用方未显式提供参数时应用到检索与生成阶段。

#### Scenario: 显式参数优先
- **GIVEN** 请求显式提供了 `top_k/min_score`
- **WHEN** 系统生成某个 OutputType 的输出
- **THEN** 系统 MUST 使用显式提供的 `top_k/min_score`
- **AND** MUST NOT 被默认 tuning 覆盖

#### Scenario: 未显式提供时应用默认 tuning
- **GIVEN** 请求未显式提供 `top_k/min_score`
- **WHEN** 系统生成某个 OutputType 的输出且 `preference=quality`
- **THEN** 系统 MUST 使用该 OutputType 的 quality 默认 tuning
