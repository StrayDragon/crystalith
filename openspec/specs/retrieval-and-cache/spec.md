# retrieval-and-cache Specification

## Purpose

定义共享检索策略与缓存失效模型，覆盖 outputs/slides/qa/refine 等路径的统一检索行为。

## Non-goals

- 不定义具体输出渲染
- 不定义部署缓存中间件拓扑

## Requirements

### Requirement: Retrieval strategy is shared across generation paths
outputs 与 slides MUST 复用同一检索策略族（预算、去重、多样性、融合）。

### Requirement: Retrieval context obeys token budget
检索上下文 MUST 受 token budget 约束，超预算时 MUST 截断或压缩。

### Requirement: Multi-query retrieval is bounded
启用 multi-query 时 MUST 受 seed 上限、融合策略与去重规则约束。

### Requirement: Epoch-based cache invalidation is canonical
sources/vector 相关缓存 MUST 基于 `sources_epoch` 与 `vector_epoch` 失效。

### Requirement: Epoch bumps are atomic and monotonic
并发下 epoch 递增 MUST 原子且单调递增。

### Requirement: Optional retrieval assembly cache is versioned
若启用检索组装缓存，key MUST 包含 epoch 版本信息以避免脏命中。
