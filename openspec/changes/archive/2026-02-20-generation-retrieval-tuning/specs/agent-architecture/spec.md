## ADDED Requirements

### Requirement: ResolveContext applies retrieval strategy and budget
系统 MUST 在 OutputGraph 的 ResolveContext 阶段应用共享检索策略（去重/多样性）与 token budget，并产出可控的 retrieval context。

#### Scenario: ResolveContext 预算截断
- **WHEN** ResolveContext 构建的 retrieval context 超过预算
- **THEN** 系统截断或压缩 retrieval context

### Requirement: Preference influences retrieval strategy
系统 MUST 允许 `preference` 影响检索策略（例如 top_k/min_score、预算大小、是否启用 multi-query）。

#### Scenario: speed 使用更小预算
- **WHEN** `preference = speed`
- **THEN** 系统使用更小的 retrieval context budget（相对默认/quality）
