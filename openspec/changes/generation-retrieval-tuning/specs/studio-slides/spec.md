## ADDED Requirements

### Requirement: Slides context uses shared retrieval strategy
系统 MUST 在 slides outline/markdown 两阶段使用共享检索策略与 token budget 构建上下文。

#### Scenario: slides 两阶段应用 budget
- **WHEN** slides outline 或 markdown 构建 context
- **THEN** 系统对 retrieval context 应用 token budget

### Requirement: Slides retrieval enforces source diversity
系统 MUST 在 slides 的 context 构建中限制单一来源占比，提升覆盖与稳定性。

#### Scenario: 单源不会占满 context
- **WHEN** 某一来源的 chunk 在检索排序中占据大多数
- **THEN** slides context 中来自该 source 的 chunk 数受限于多样性规则
