# cache-policy-visibility-and-stampede-guards 规范增量

## ADDED Requirements

### Requirement: Retrieval-related Caches MUST Declare Admission and Bypass Policies
系统 MUST 为 embedding、vector/search 与 assembly 等关键缓存声明 admission 与 bypass policy，而不是任由调用方猜测何时缓存。

#### Scenario: 某次请求因 guardrail 绕过缓存
- **WHEN** 请求规模、文本大小、参数组合或依赖状态不适合进入缓存
- **THEN** 系统 SHALL 产生稳定的 bypass reason
- **AND** diagnostics SHALL 能看到该请求为何未被缓存

### Requirement: Hot Keys MUST Be Protected by Stampede Guards
系统 MUST 对关键缓存域提供 stampede guards，避免同一热点 miss 同时打爆底层资源。

#### Scenario: 多个请求同时访问同一热点 key
- **WHEN** 同一 cache key 在短时间内被多个请求同时 miss
- **THEN** 系统 SHALL 使用 singleflight、soft TTL、jitter 或等价机制限制雪崩
- **AND** SHALL 不让所有 miss 一起直接冲击向量库或 embedding provider
