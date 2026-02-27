## ADDED Requirements

### Requirement: Lint and contract checks are part of the quality gate
CI 与本地默认检查入口 MUST 覆盖 lint 与关键 API contract checks，以降低回归风险。

#### Scenario: Local checks match CI guardrails
- **WHEN** 开发者在本地运行默认检查入口（例如 `just check` 或等价）
- **THEN** 该入口 SHALL 覆盖 lint 与关键 contract checks
- **AND** 在失败时返回非 0 并给出可执行的修复建议

### Requirement: Lint adoption is incremental and actionable
lint 引入 MUST 采用增量策略，避免一次性全仓重写导致评审噪声与维护成本爆炸。

#### Scenario: Lint focuses on changed files first
- **WHEN** lint 新规则引入到仓库
- **THEN** 系统 SHALL 优先对新增/变更代码严格执行
- **AND** 对历史遗留问题提供 baseline/ignore 的过渡机制
