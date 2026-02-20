## ADDED Requirements

### Requirement: Generation trace correlation
系统 MUST 为每一次生成请求生成一个 `trace_id`，并在该请求的所有关键日志中包含该 `trace_id`，以便跨阶段串联分析。

#### Scenario: outputs 生成日志可串联
- **WHEN** 用户触发一次 outputs 生成
- **THEN** context 解析、模型生成、持久化等关键日志均包含同一个 `trace_id`

#### Scenario: slides 两阶段日志可串联
- **WHEN** 用户分别触发 slides outline 与 markdown 生成
- **THEN** 每个阶段内部的关键日志均包含该阶段的 `trace_id`

### Requirement: Standardized stage timing fields
系统 MUST 在生成链路中记录阶段耗时字段（按路径可选），用于定位瓶颈与回归比较。

#### Scenario: context 解析阶段包含分段耗时
- **WHEN** 系统执行基于向量检索的 context 解析
- **THEN** 日志包含 `embed_ms` 与 `search_ms`
- **AND** 若发生 DB 加载与格式化，则包含 `db_ms` 与 `format_ms`

### Requirement: Standardized error classification
系统 MUST 在生成失败时记录标准化的错误分类字段 `error_kind`，并记录重试配置与是否触发 fallback。

#### Scenario: 失败记录包含 error_kind 与 retries
- **WHEN** 模型调用失败并触发 fallback
- **THEN** 日志包含 `error_kind`
- **AND** 日志包含 `agent_retries`
- **AND** 日志包含 `fallback = true`

### Requirement: Cache hit/miss observability (vector search)
当生成链路使用向量检索缓存时，系统 MUST 记录 cache hit/miss，并尽可能携带 `trace_id` 以便关联。

#### Scenario: cache hit 记录
- **WHEN** 向量检索命中缓存
- **THEN** 系统记录 cache hit

#### Scenario: cache miss 记录
- **WHEN** 向量检索未命中缓存
- **THEN** 系统记录 cache miss
