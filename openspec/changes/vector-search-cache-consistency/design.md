## Context

当前向量检索缓存实现（`cached_vector_search`）通过 cache key 缓存 query 结果，并通过写路径执行 pattern invalidation（例如 `notebook:{id}:vector_search:*`）来失效。

问题：

- Redis 场景下 pattern invalidation 依赖 `SCAN` + `DEL`，在高基数键空间下可能引入显著开销与抖动。
- 缓存 key 与“向量集合变更”的关系不明确，缺少可验证的一致性契约（epoch/version）。

约束：

- 当前 `CacheProvider` 接口只有 get/set/delete/invalidate_pattern，没有原子自增等语义。
- 需要同时兼容 InMemoryCache 与 RedisCache。

## Goals / Non-Goals

**Goals:**
- 将向量检索缓存从“模式扫描失效”迁移为“版本化 key（epoch）”失效：写路径 O(1) bump epoch。
- 明确 cache key contract：参数维度 + epoch + TTL。
- 统一所有会改变 notebook 向量集合的写路径触发点（ingest/re-embed/delete/转换等）。

**Non-Goals:**
- 不更换缓存后端或新增专用 KV 系统。
- 不要求强一致的“原子 epoch 递增”能力（允许轻微竞争但保证 epoch 变化足以失效旧缓存）。

## Decisions

### 1) 引入 per-notebook vector_epoch

- epoch key：`notebook:{notebook_id}:vector_epoch`
- 默认 epoch：0（key 不存在时）
- bump 策略：`epoch = (get(epoch) or 0) + 1` 再 set 回去
  - 并发 bump 可能丢失增量，但只要 epoch 发生变化即可完成失效目标。

### 2) 将 epoch 纳入 vector_search cache key

新的 cache key 结构（示意）：

- `notebook:{id}:vector_search:v{epoch}:{digest}`

其中 digest 仍基于：

- query_vector hash
- top_k/min_score
- source_ids / exclude_source_ids

epoch 变化后 key 前缀变化，旧 key 自然失效（等待 TTL 淘汰），无需 SCAN 删除。

### 3) TTL 与容量

- vector_search 缓存 TTL 可独立设置（例如 60–300s），避免 key 累积。
- epoch key 不设置 TTL 或设置较长 TTL（Redis），确保重启/短暂失联不会频繁回到 0（可接受但会降低命中率）。

### 4) 写路径触发点统一

所有会影响向量集合的操作必须 bump epoch：

- source ingest（新增 chunks/vectors）
- source re-embed（向量更新）
- source delete / notebook delete（向量删除）
- 将内容转为 source（新增向量）

原有 pattern invalidation 可逐步移除或仅保留兜底（过渡期）。

## Risks / Trade-offs

- [epoch 额外一次 cache get] → 每次检索多一次读取；可在请求内缓存 epoch（同一请求多次 search 时复用）。
- [旧 key 积累] → 依赖 TTL；必要时可保留低频后台清理或限定 key 前缀。
- [InMemoryCache 下 epoch 重启丢失] → 仅影响命中率，不影响正确性。

## Migration Plan

- 先引入 epoch key 与新 cache key（同时保留旧 pattern invalidation 触发）。
- 确认命中率/性能稳定后，逐步移除 SCAN-based invalidation，保留必要兜底。

## Open Questions

- epoch 是否需要落在 DB（跨 cache 后端共享）？目前倾向不需要，cache 语义足够。
- 是否需要把 epoch 与向量存储的 collection 版本关联（例如重建索引）？
