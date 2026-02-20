## ADDED Requirements

### Requirement: OutputType-aware Query Seeds
系统 SHOULD 基于 `OutputType` 为 multi-query 生成额外的 query seeds/hints，以提高检索覆盖稳定性。

#### Scenario: Timeline seeds 更关注日期/事件
- **GIVEN** output_type 为 TIMELINE 且启用 multi-query
- **WHEN** 系统生成 query seeds
- **THEN** seeds SHOULD 包含与日期/事件抽取相关的提示（在不泄露实现细节的前提下）

#### Scenario: Seeds 数量受上限控制
- **WHEN** multi-query 启用
- **THEN** 系统 MUST 将 seeds 数量限制在可配置/可调的上限内
