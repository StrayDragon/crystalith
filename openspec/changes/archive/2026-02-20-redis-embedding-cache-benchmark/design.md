## Context

项目在 `cache.provider=redis` 时会启用 embedding 共享缓存（`CachedEmbeddingProvider`），并通过 `CRYSTALITH_EMBEDDING_CACHE_*` 环境变量控制 TTL/max_texts/max_chars 等 guardrails。该机制能显著降低重复 embedding 的开销，但其收益与代价高度依赖数据分布（文本去重率、批量大小、文本长度）与 Redis 资源（内存、网络延迟、序列化开销）。

为了上线前快速评估参数取舍，并在上线后回归验证，需要一个可重复运行的 benchmark 工具和最小的 cache hit/miss 可观测性。

## Goals / Non-Goals

**Goals:**
- 提供可脚本化的 embedding cache benchmark：输出 hit/miss、耗时、Redis 内存与 key 数量等摘要
- 在 embedding cache wrapper 中提供最小统计（供 benchmark/日志采集）
- 文档化启用方式与参数调优建议

**Non-Goals:**
- 不实现完整的分布式压测平台/生产级 metrics pipeline
- 不改变 embedding provider 的对外接口（仍返回 vectors）
- 不覆盖 bulk ingestion 的大批量场景（现有 guardrails 会刻意绕过缓存）

## Decisions

1. **在 `CachedEmbeddingProvider` 内部计算并暴露一次调用的统计**
   - 统计字段包括：texts 数、unique keys 数、hit/miss 数、cache get/set 耗时
   - 默认不强制写日志，benchmark 脚本按需读取/打印

2. **新增 `scripts/embedding_cache_bench.py`**
   - 通过 `ConfigManager` 加载配置（遵循现有 env overrides 机制）
   - 在 `cache.provider=redis` 时连接 Redis，读取 `INFO memory` 与可选的 key 计数（基于 prefix）
   - 支持 warmup + repeat 的对比：首轮写入缓存，后续轮次观察命中与时延

3. **提供 `just` 入口与文档说明**
   - 新增 `just embedding-cache-bench`（或类似命令）方便运行
   - 文档中记录常用 env 调参点与判读方式

## Risks / Trade-offs

- [风险] benchmark 扫描 keys 可能对 Redis 产生额外负载 → [缓解] 仅在需要时启用 key 统计；限制扫描数量；默认只读取 memory 信息
- [风险] 统计口径与真实生产流量分布不同 → [缓解] 脚本支持可配置的文本规模/重复率/批量大小，尽量贴近线上调用模式
