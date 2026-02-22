# backend-performance Specification

## Purpose

定义后端的性能与可靠性护栏（guardrails）：缓存抽象与配置、热点读取路径的缓存与失效、重试边界、阶段级并发限制与取消策略，以及 embedding 共享缓存的护栏与压测基准。

本 spec 偏“平台层不变量”。具体业务链路（retrieval/observability/vector cache 等）细节由对应 spec 负责，避免重复描述。

## Related specs

- `config-management/spec.md`
- `generation-retrieval/spec.md`
- `generation-observability/spec.md`
- `vector-search-cache/spec.md`
- `source-ingestion-management/spec.md`
- `llm-evaluation/spec.md`

## Requirements

### Requirement: Cache Provider Interface
系统 SHALL 提供统一的缓存抽象接口（CacheProvider），支持：

- `get/set/delete`
- `get_many/set_many`
- `invalidate_pattern`（用于开发/维护场景；生产失效策略不应依赖全量扫描）

系统 MUST 提供至少两种实现：InMemoryCache（默认）与 RedisCache（可选）。
批量 API 的返回 MUST 与 keys 等长并按输入顺序对齐（包括 InMemoryCache）。

### Requirement: Cache configuration is explicit
系统 SHALL 在配置中支持缓存相关配置项（字段名稳定）：

- `cache.provider: "memory"|"redis"`
- `cache.ttl: int`（秒）
- `cache.max_size: int`（仅内存缓存）
- `cache.redis_url: string | null`（provider=redis 时必填）
当配置未显式设置 cache 段时，系统 MUST 默认使用 InMemoryCache。

### Requirement: Hot read caches avoid high-cost invalidation
系统 SHOULD 对 notebook 列表、sources 列表与 chunks 列表等热点读取路径进行缓存；并 MUST 使用可控、低成本的失效策略，避免在 Redis 场景依赖高成本的 SCAN+DEL 作为主要失效方式。

具体 epoch/version 化策略见：

- sources 列表/chunks 列表：`source-ingestion-management/spec.md`（`sources_epoch`）
- 向量检索缓存：`vector-search-cache/spec.md`（`vector_epoch`）
当 sources 或向量集合变更并 bump epoch 时，新请求 MUST 不再命中旧 epoch 缓存 key，且无需扫描删除旧 key。

### Requirement: Retry boundaries are not stacked
系统 MUST 明确重试边界，避免 SDK 与业务层重试叠加导致尾延迟膨胀；可重试错误（限流/超时/短暂网络失败）SHOULD 由业务层策略统一处理，并可观测。
系统遇到可重试的 provider 错误（如 429/503/超时）时，MUST 不得同时触发 SDK 重试与业务层重试（避免 nested backoff）。

### Requirement: Stage-level concurrency limits exist
系统 MUST 为关键 I/O 阶段提供并发限制（至少包括 embedding、vector search、LLM generation），并允许通过配置调整上限（0 表示禁用 limiter）。
当 embedding 并发上限为 N 时，同时触发超过 N 个 embedding 请求，实际并发执行数 MUST 不超过 N（其余等待）。

### Requirement: Cancellation avoids wasteful work
系统 SHOULD 在请求取消/断开时尽早停止后续阶段，减少无效计算与资源占用。
当 SSE/streaming 请求被客户端断开时，服务端 SHOULD 尽快停止后续 token 生成与无必要的 I/O。

### Requirement: Embedding shared cache has guardrails
系统 MAY 提供 embedding 共享缓存（通常依赖 Redis）；当启用时，缓存实现 MUST 具备护栏以避免批量 ingest 冲击缓存后端：

- 对“大 batch”或“超长文本”跳过缓存
- 以内容 SHA256 作为 key，避免 raw content 进入 keyspace

启用路径 SHOULD 受以下开关控制（字段名稳定）：

- 仅当 `cache.provider = "redis"` 且 `CRYSTALITH_EMBEDDING_CACHE_ENABLED=true` 时启用
- `CRYSTALITH_EMBEDDING_CACHE_TTL_S`
- `CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS`
- `CRYSTALITH_EMBEDDING_CACHE_MAX_CHARS`
单次 embed_batch 文本数超过阈值或存在超长文本时，系统 MUST 跳过 embedding cache 并直接调用 provider。

### Requirement: Embedding cache benchmark exists
系统 MUST 提供用于评估 embedding 共享缓存收益与成本的基准能力，并输出可观测统计（至少包括 hit/miss 与关键阶段耗时摘要），以支持上线前压测与上线后回归。
开发者运行基准任务（例如 `just embedding-cache-bench`）时，输出 MUST 包含命中率、耗时与缓存占用相关摘要（机器可读或人类可读均可）。
