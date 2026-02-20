## Context

当前后端已具备：
- `CacheProvider` 抽象与 InMemory/Redis 实现，用于高频查询缓存与向量检索缓存。
- 质量/速度的生成倾向（GenerationPreference），可影响检索参数与 Agent 重试策略。
- multi-query retrieval：质量优先时可能产生多个 query embedding，并触发多次向量检索/缓存命中判定。

在 Redis 场景下，`cached_vector_search_many` 逐个 `GET/SET` 会引入多次网络往返，尤其在 multi-query 与后续扩展（更多 seed）时放大延迟。

另一方面，tool 类型输出（FAQ/Guide/Timeline/Mindmap/Quiz/Briefing/Slides）与摘要型输出（Paragraph/Bullets/Structured）对上下文覆盖度/去噪的最佳默认值并不相同；当前调参入口主要围绕 preference，缺少“输出类型”维度的默认策略。

## Goals / Non-Goals

**Goals:**
- 为缓存层提供批量读写能力，以降低 Redis 往返次数。
- 将向量检索多查询缓存路径切换为批量缓存读取/写入，保持语义一致。
- 引入“输出类型 + preference”的默认调参入口（仅在未显式传参时生效），让 tool 类型输出在质量模式下默认覆盖更充分。
- 补充单元测试，覆盖批量缓存与 `cached_vector_search_many` 行为。

**Non-Goals:**
- 不引入新的外部依赖（例如压缩、二进制序列化、或新的缓存中间件）。
- 不改变公开 API 形状（仅默认策略/性能行为变化，显式参数优先）。
- 不做大规模 RAG 流水线重构（如全链路 streaming、跨阶段共享 embedding 等）。

## Decisions

### 1) CacheProvider 增加批量接口

- 新增：
  - `get_many(keys) -> list[value|None]`：对齐输入顺序，便于 callers 按位置回填。
  - `set_many(items, ttl=...)`：一次性写入多个键，ttl 统一（满足向量检索缓存的典型用法）。
- InMemoryCache：在同一把锁内完成批量读写，复用 TTL/LRU 语义。
- RedisCache：
  - `get_many` 使用 `MGET`；
  - `set_many` 使用 pipeline 批量 `SET`（可带 EX）。

理由：这是最小侵入、收益明显的优化点；对 callers 透明，且可逐步扩展到其他缓存热点。

### 2) cached_vector_search_many 使用批量缓存

- 将原本 per-key `get`/`set` 改为：
  - 先批量拉取所有 keys；
  - 对缺失项执行 `vector_store.search_many`（如可用）；
  - 将缺失结果批量写回缓存。

理由：在 multi-query retrieval 的质量路径里，可以显著减少 Redis RTT；对 Chroma 的实际 query 次数不变（仍按 miss 执行）。

### 3) 输出类型 + preference 的默认调参入口

- 新增 helper（例如 `tuning_for_request(output_type, preference)`）：
  - 以现有 `tuning_for_preference(preference)` 作为基线；
  - 对 tool 类型输出在 `quality` 模式下做轻量增益（例如 `top_k + 2`、`min_score - 0.05`，并做边界裁剪）。
- 仅在调用方未显式指定 `top_k/min_score` 时应用默认值（避免破坏已有显式控制）。

理由：给“每个输出类型”留出策略入口，同时先用保守规则落地；后续可基于 observability 日志做数据驱动调参。

## Risks / Trade-offs

- [缓存接口扩展] → 需要确保所有 CacheProvider 实现同步升级；通过单测覆盖与 CI 保障。
- [默认调参可能引入成本上升] → 仅在 `preference=quality` 且 tool 类型生效；显式参数可覆盖；后续根据日志再调小/调大。
- [Redis JSON 序列化开销] → 本次缓存值体积小（向量检索结果仅包含 source_id/chunk_id/score），整体收益仍以减少 RTT 为主。

## Migration Plan

- 代码级兼容升级（无数据库迁移）。
- 发布后观察：
  - `cached_vector_search_many` 的 cache_hit/cache_miss 量与生成端 `duration_ms`；
  - tool 类型输出在质量模式下的 evidence/citation 覆盖与用户反馈。
- 如发现质量模式成本过高，可通过显式参数或回滚该默认策略变更。

## Open Questions

- tool 类型输出在质量模式下的最佳 `top_k/min_score` 是否需要按类型细分（Timeline vs Quiz vs Briefing）？
- 是否需要为 embedding 做跨进程缓存（Redis embedding cache）以进一步降低重复 query 的开销？
