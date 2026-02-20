## Context

生成链路涉及多段 I/O：
- embedding（可能 multi-query）
- vector search（可能 `search_many` + DB load）
- LLM 生成（可能含 schema 重试与 repair pass）
- DB 持久化

在高并发或用户重复触发时，缺少统一并发护栏会导致：
- embedding/search/model 互相挤占资源（CPU/IO/连接池），尾延迟放大
- 请求取消后仍继续执行后续阶段，浪费算力并加剧拥塞
- rate limit 下重试行为不统一，可能形成“雪崩式重试”

## Goals / Non-Goals

**Goals:**
- 为关键阶段引入并发限制（可配置），并在 HTTP 请求取消时尽早停止后续工作。
- 统一重试与退避策略：遵循 Retry-After；避免嵌套重试；区分 schema 重试与 provider 重试。
- 提供必要的可观测性：limiter 等待时间、是否被取消、重试次数等。

**Non-Goals:**
- 不实现全局复杂的优先级队列/调度系统（先做简单 limiter）。
- 不把所有路径强行串行化（仅限制并发上限）。

## Decisions

### 1) 以“阶段级 limiter”为最小可行方案

为阶段设置独立 limiter（示例）：
- embedding limiter
- vector search limiter
- LLM generation limiter

理由：不同阶段资源瓶颈不同（embedding 可能 CPU/网络，vector search 可能 DB/向量库，LLM 可能网络/速率限制）；分阶段更可控。

### 2) limiter 配置归属 Settings（并提供安全默认值）

新增/扩展配置（具体字段以实现为准）：
- `concurrency.embedding`
- `concurrency.vector_search`
- `concurrency.llm_generate`

并允许通过 env overrides 调整。

理由：并发策略与部署环境强相关（本地、单机、容器、云）；必须可配置。

### 3) 取消语义：尽早停止 + 不写入副作用

- 如果请求取消（客户端断开、超时），尽早取消未开始的阶段。
- 对已开始的阶段，尽可能传播取消信号（或在安全点检查并提前返回）。
- 对输出持久化：取消/失败不应产生半成品（或应明确标记为 error）。

### 4) rate limit 与重试策略统一

- 对 provider 错误遵循 `Retry-After`（若存在），并设置最大重试次数与总超时预算。
- schema/验证重试仍由 Agent 的 retries 控制，但不得触发 provider 层嵌套重试。

## Risks / Trade-offs

- [吞吐下降] → limiter 会降低峰值吞吐，但换来更稳定尾延迟与更可控资源占用；默认值应保守但可调。
- [取消传播不完全] → 需要确保关键 await 点能响应取消；通过单测与日志验证。

## Migration Plan

- 第一步：实现 limiter 抽象与默认配置，并在 outputs/slides/refine 等入口接入。
- 第二步：补齐取消语义与可观测性字段。
- 第三步：压测并基于数据调整默认并发上限。

## Load Test Checklist

用于验证 limiter 带来的尾延迟与吞吐变化（建议按「本地 → Redis → 线上」逐步推进）。

### 本地（memory cache / 单机）

- [ ] 设定固定并发上限：`concurrency.embedding/vector_search/llm_generate`（例如 8/8/4），记录 baseline
- [ ] 触发多用户并发 outputs/slides/qa/refine，观察日志字段：
  - `*_limit`、`*_wait_ms`、`*_hit` 是否出现（等待应随压测升高而升高）
  - `embed_ms/search_ms/generate_ms` 是否仍可解释（等待与执行时长分离）
- [ ] 观察尾延迟：p95/p99 响应时间是否更稳定（抖动下降）
- [ ] 观察错误：429/503/timeout 是否下降；是否遵循 `Retry-After`（无雪崩式重试）
- [ ] 取消语义：客户端断开/取消后，生成链路是否尽早停止且不产生额外 DB 副作用

### Redis（cache.provider=redis）

- [ ] 开启 Redis 后重复上述压测，比较：
  - embedding 缓存命中率变化（如已启用 embedding cache）
  - Redis 内存占用与 key 数量（确认 TTL/上限配置合理）
- [ ] 观察 retrieval assembly cache（如开启）对 `vector_search` 压力与尾延迟的影响

### 线上（或类线上环境）

- [ ] 分阶段灰度调高 `llm_generate` 并发上限，避免瞬时放大速率限制
- [ ] 关注模型供应商限流策略：429 与 `Retry-After` 分布是否稳定
- [ ] 关注资源指标：CPU、连接池、向量库/DB QPS、队列长度、任务积压
- [ ] 回滚预案：可通过配置将 limiter 设为 0（禁用）或降到更保守值

## Open Questions

- limiter 是否需要区分“按模型”或“按用户/会话”维度？
- background task queue 与前台请求是否共享 limiter，还是各自独立？
