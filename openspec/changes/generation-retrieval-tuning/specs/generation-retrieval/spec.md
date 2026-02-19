## ADDED Requirements

### Requirement: Shared retrieval strategy for generation
系统 MUST 为 outputs 与 slides 的生成提供共享的检索与上下文构建策略，避免不同路径行为漂移。

#### Scenario: outputs 与 slides 使用同一策略模块
- **WHEN** 系统在 outputs 与 slides 中执行检索与 context 构建
- **THEN** 两者复用同一策略实现（共享去重、过滤、预算与多样性规则）

### Requirement: Token budget for retrieval context
系统 MUST 对检索得到的 retrieval context 应用 token budget，避免超长上下文导致的失败率与成本增加。

#### Scenario: retrieval 超过预算会被截断
- **WHEN** 检索得到的 context 超过配置的 retrieval token budget
- **THEN** 系统截断或压缩 retrieval context

### Requirement: Deduplication and source diversity
系统 MUST 在构建 context 时去重并保证来源多样性，避免单一来源占满上下文。

#### Scenario: chunk_id 不重复
- **WHEN** 系统构建 context
- **THEN** 返回的 `resolved_chunk_ids` 中不包含重复 chunk_id

#### Scenario: 限制单一 source 的 chunk 数
- **WHEN** 某一来源在相似度排序中占据大量结果
- **THEN** 系统限制每个 source 进入 context 的 chunk 数不超过配置上限

### Requirement: Optional multi-query retrieval (quality)
系统 MUST 支持在质量优先模式下启用 multi-query retrieval，并在启用后合并与裁剪结果。

#### Scenario: quality + multi-query enabled 合并结果
- **WHEN** `preference = quality`
- **AND** multi-query retrieval 功能已启用
- **THEN** 系统使用多个查询种子检索并合并结果
- **AND** 合并结果经过去重与多样性裁剪
