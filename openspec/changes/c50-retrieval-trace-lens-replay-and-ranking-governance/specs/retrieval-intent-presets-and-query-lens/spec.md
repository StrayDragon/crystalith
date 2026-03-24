# retrieval-intent-presets-and-query-lens 规范增量

## ADDED Requirements

### Requirement: Retrieval Intent MUST Be Expressed as Stable Query Lenses
系统 MUST 让常见检索意图通过稳定 query lenses 表达，而不是把检索偏好隐藏在不可见策略里。

#### Scenario: 用户选择不同检索目标
- **WHEN** 用户需要概览、证据、反例或等价检索意图
- **THEN** 系统 SHALL 用对应 lens 表达该意图
- **AND** SHALL 让该 lens 对后续检索与解释保持可追踪

### Requirement: Seed Catalog MUST Make Query Rewrites Explainable
系统 MUST 将 query rewrite 产生的 seed 显式记录到 seed catalog，而不是只留下最后送去检索的一串文本。

#### Scenario: 系统对用户 query 执行 rewrite 和扩展
- **WHEN** 系统生成 normalize、expand、diversify 或 prune 后的检索 seeds
- **THEN** 系统 SHALL 记录这些 seed 的类型、文本与理由
- **AND** SHALL 允许调试视图解释哪些 seed 被保留或裁掉
