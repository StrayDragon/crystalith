# backend-performance Specification

## Purpose
TBD - created by archiving change add-caching-layer. Update Purpose after archive.
## Requirements
### Requirement: Cache Provider Interface
系统 SHALL 提供统一的缓存抽象接口（CacheProvider），支持 get、set、delete 和基于模式的批量失效操作。系统 MUST 提供至少两种实现：InMemoryCache（默认）和 RedisCache（可选）。

#### Scenario: 内存缓存读写
- **WHEN** 使用 InMemoryCache 写入一个键值对并立即读取
- **THEN** 返回写入的值

#### Scenario: 缓存 TTL 过期
- **WHEN** 写入一个键值对并等待超过 TTL 时间后读取
- **THEN** 返回 None / 缓存未命中

#### Scenario: 缓存模式失效
- **WHEN** 调用 invalidate_pattern 传入通配模式
- **THEN** 所有匹配该模式的缓存键被删除

### Requirement: Query Result Caching
系统 SHALL 对 notebook 列表、source 列表和 chunk 检索等高频读取路径的查询结果进行缓存。缓存 MUST 在对应数据发生变更（创建、更新、删除）时自动失效。

#### Scenario: Source 列表缓存命中
- **WHEN** 连续两次请求同一 notebook 的 source 列表，且期间无数据变更
- **THEN** 第二次请求从缓存返回，不查询数据库

#### Scenario: Source 变更触发缓存失效
- **WHEN** 向 notebook 添加新 source 后请求 source 列表
- **THEN** 缓存已失效，返回包含新 source 的最新列表

### Requirement: Cache Configuration
系统 SHALL 在配置文件中支持缓存相关配置项，包括 provider 类型、TTL、最大缓存大小和 Redis 连接信息（可选）。

#### Scenario: 默认缓存配置
- **WHEN** 配置文件中未指定 cache 段
- **THEN** 系统使用 InMemoryCache 并采用默认 TTL 和大小限制

### Requirement: Retry Boundary Clarity
系统 MUST 明确重试边界，避免 SDK 与业务层重试叠加导致尾延迟膨胀。系统 SHOULD 将可重试错误（限流/超时/短暂网络失败）统一交由业务层策略处理。

#### Scenario: 不出现嵌套 backoff
- **WHEN** 系统遇到可重试的 provider 错误（例如 429/503/超时）
- **THEN** 系统 MUST 不得同时触发 SDK 重试与业务层重试
- **AND** 日志 SHOULD 能区分“格式重试（schema）”与“网络重试（provider）”

### Requirement: Effective Settings Observability
系统 SHOULD 在生成相关日志中记录 effective settings（timeout、max_retries、completion options），以便快速定位配置不生效或性能回归。

#### Scenario: 输出 effective settings
- **WHEN** 系统完成一次生成请求
- **THEN** 日志 SHOULD 包含 timeout、max_retries、temperature/max_tokens 等关键字段（若适用）

### Requirement: Effective Tuning Observability
系统 SHOULD 在生成相关日志中记录 effective tuning（至少包括 top_k/min_score/agent_retries 以及与 multi-query/budget 相关的关键字段），以支持数据驱动调参回归。

#### Scenario: 日志包含 effective tuning
- **WHEN** 系统完成一次输出生成请求
- **THEN** 日志 SHOULD 包含 effective `top_k`、`min_score`、`agent_retries`
- **AND** SHOULD 包含 query_count 与关键阶段耗时（embed/search/generate 等）

### Requirement: Multi-query Cost Controls
系统 MUST 在 multi-query 场景下提供成本控制点（至少包括 seeds 上限与可观测的 query_count），并将其纳入默认 tuning。

#### Scenario: 记录 query_count
- **WHEN** 系统执行 multi-query 检索
- **THEN** 日志/指标 MUST 记录 query_count（实际 seeds 数）

### Requirement: Optional Retrieval Assembly Cache
系统 MAY 提供短 TTL 的检索组装缓存（在安全边界内），用于降低重复检索/格式化的开销。

#### Scenario: 相同输入命中缓存
- **GIVEN** 在短时间内重复以相同 notebook_id/source_ids/seeds 等参数请求检索
- **WHEN** 第二次请求发生
- **THEN** 系统 MAY 从缓存返回等价的检索结果并减少 DB/format 开销

### Requirement: Timings are Exportable for Evaluation
系统 SHOULD 以稳定字段名提供分阶段 timings（embed/search/db/format/generate/total 等）与 query_count，供评测工具与性能回归使用。

#### Scenario: 评测工具可读取 timings
- **GIVEN** 一次生成请求的结果与日志/返回结构
- **WHEN** 评测工具收集指标
- **THEN** 工具 SHOULD 能读取 query_count 与关键阶段耗时字段并纳入报告

### Requirement: Stage-level Concurrency Limits
系统 MUST 为关键 I/O 阶段提供并发限制（至少包括 embedding、vector search、LLM generation），并允许通过配置调整上限。

#### Scenario: embedding 并发受限
- **GIVEN** 配置设置 embedding 并发上限为 N
- **WHEN** 同时触发超过 N 个 embedding 请求
- **THEN** 系统 MUST 限制并发执行数不超过 N（其余请求等待或排队）

#### Scenario: limiter 等待可观测
- **WHEN** 请求因 limiter 等待而延迟
- **THEN** 系统 SHOULD 记录等待耗时（用于性能分析）

### Requirement: Cancellation Avoids Wasteful Work
系统 SHOULD 在请求取消时尽早停止后续阶段，减少无效计算与资源占用。

#### Scenario: 请求取消后停止生成
- **WHEN** 客户端断开或请求被取消
- **THEN** 系统 SHOULD 尽早停止尚未开始的阶段

### Requirement: Embedding Cache Benchmark and Observability
系统 MUST 提供用于评估 embedding 共享缓存（Redis）收益与成本的基准能力，并输出可观测统计（至少包括 hit/miss、关键阶段耗时与内存占用摘要），以支持上线前压测与上线后回归。

#### Scenario: 可重复运行 benchmark
- **WHEN** 开发者运行 embedding cache benchmark 工具
- **THEN** 工具 MUST 输出机器可读或人类可读的摘要（命中率、耗时、内存/键数量等）

#### Scenario: hit/miss 统计可获取
- **WHEN** embedding 共享缓存被启用
- **THEN** 系统 MUST 能提供每次 embed_batch 的 hit/miss 统计（或等价统计），便于压测采集
