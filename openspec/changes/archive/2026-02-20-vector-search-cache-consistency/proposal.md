## Why

向量检索已成为多条高频路径的关键依赖（outputs / slides / QA / refine）。我们已经引入 `cached_vector_search`，但缓存一致性与失效策略仍缺少清晰契约：目前主要依赖 pattern invalidation（在 Redis 上会引入扫描成本），同时缓存 key 与向量状态变更的关系不够明确，容易在“更新向量/删除来源/重嵌入”等场景出现短时间不一致或失效不完全的问题（即便 TTL 较短，也会影响用户体感与调参结论）。

因此需要把“向量检索缓存”作为一个明确能力来定义：key 组成、TTL、失效触发点、以及在 Redis 场景下的可扩展性。

## What Changes

- 定义一致的 vector search cache contract：
  - key 组成必须能区分：notebook、query、top_k/min_score、source_ids/exclude_source_ids，以及向量索引的“版本/epoch”
  - 明确 TTL（可独立于全局 cache 默认 TTL），并给出推荐默认值
- 从 pattern invalidation 迁移到“版本化 key”（epoch/version）：
  - 维护 `notebook:{id}:vector_epoch`（或等价机制），写入缓存时将 epoch 纳入 key
  - 向量状态变更时仅 bump epoch（O(1)），避免 SCAN + delete
- 统一失效触发点：
  - source ingest / re-embed / delete / convert-to-source 等所有会改变向量集合的操作都必须 bump epoch
- 校验与可观测：
  - 结构化记录 cache hit/miss、epoch、以及“疑似过期命中”的检测信号，为后续调参提供可信数据

## Capabilities

### New Capabilities
- `vector-search-cache`: 定义向量检索缓存的 key、TTL、失效/版本化策略、以及一致性保证（含 Redis 场景的可扩展性约束）。

### Modified Capabilities
- `backend-performance`: 将向量检索缓存纳入缓存策略要求，约束生产环境避免高成本 pattern invalidation，并明确向量相关变更必须触发缓存失效。

## Impact

- Backend
  - `cached_vector_search` 的 key 设计与失效策略调整（引入 epoch/version）
  - sources 相关写路径统一 bump epoch（替代 invalidate_pattern）
  - Redis 场景下显著降低失效成本与热点 SCAN 风险
- 测试/验收
  - 单测：epoch bump 后旧 key 不再命中；写路径触发点覆盖完整
  - 压测/观测：对比 pattern invalidation vs epoch 的性能与一致性
