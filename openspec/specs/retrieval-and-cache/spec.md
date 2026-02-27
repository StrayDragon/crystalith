# retrieval-and-cache Specification

## Purpose

定义共享检索策略与缓存失效模型，覆盖 outputs/slides/qa/refine 等路径的统一检索行为。该规范强调检索上下文一致性与可预测缓存失效，避免跨路径出现“同输入不同上下文”的漂移。

## Non-goals

- 不定义具体输出渲染
- 不定义部署缓存中间件拓扑

## Requirements

### Requirement: Retrieval strategy is shared across generation paths
outputs 与 slides MUST 复用同一检索策略族（预算、去重、多样性、融合）。

#### Scenario: Shared retrieval across paths
- **WHEN** outputs 与 slides 路径执行检索
- **THEN** 系统 SHALL 复用同一检索策略族（预算/去重/多样性/融合）

### Requirement: Retrieval context obeys token budget
检索上下文 MUST 受 token budget 约束，超预算时 MUST 截断或压缩。

#### Scenario: Context truncates when over budget
- **WHEN** 组装的检索上下文超过 token budget
- **THEN** 系统 SHALL 截断或压缩上下文以满足预算约束

### Requirement: Multi-query retrieval is bounded
启用 multi-query 时 MUST 受 seed 上限、融合策略与去重规则约束。

#### Scenario: Multi-query remains bounded
- **WHEN** 启用 multi-query 检索
- **THEN** 系统 SHALL 遵守 seed 上限、融合策略与去重规则以保持有界

### Requirement: Epoch-based cache invalidation is canonical
sources/vector 相关缓存 MUST 基于 `sources_epoch` 与 `vector_epoch` 失效。

#### Scenario: Epoch invalidates stale cache
- **WHEN** sources 或 vector 发生变更并 bump epoch
- **THEN** 系统 SHALL 基于 `sources_epoch`/`vector_epoch` 使相关缓存失效以避免脏命中

### Requirement: Epoch bumps are atomic and monotonic
并发下 epoch 递增 MUST 原子且单调递增。

#### Scenario: Concurrent epoch bumps are safe
- **WHEN** 多个并发请求同时触发 epoch 递增
- **THEN** 系统 SHALL 保证递增操作原子且单调递增

### Requirement: Optional retrieval assembly cache is versioned
若启用检索组装缓存，key MUST 包含 epoch 版本信息以避免脏命中。

#### Scenario: Retrieval assembly cache key is versioned
- **WHEN** 系统启用检索组装缓存并存取 cache
- **THEN** cache key SHALL 包含 epoch 版本信息以避免命中旧上下文
