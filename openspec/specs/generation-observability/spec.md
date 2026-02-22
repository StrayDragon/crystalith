# generation-observability Specification

## Purpose

定义生成链路的可观测性要求：为一次生成请求提供可关联的 `trace_id`，记录阶段耗时与错误分类，并对缓存命中/未命中等关键事件打点，以便性能回归与线上排障。

## Related specs

- `GLOSSARY.md`
- `output-graph/spec.md`
- `backend-performance/spec.md`
- `vector-search-cache/spec.md`
- `generation-retrieval/spec.md`

## Requirements
### Requirement: Generation trace correlation
系统 MUST 为每一次生成请求生成一个 `trace_id`，并在该请求的所有关键日志中包含该 `trace_id`，以便跨阶段串联分析。
最小要求：
- outputs：context 解析/模型生成/持久化等关键日志 MUST 包含同一个 `trace_id`
- slides：outline 与 markdown 两阶段各自的关键日志 MUST 包含该阶段的 `trace_id`

### Requirement: Standardized stage timing fields
系统 MUST 在生成链路中记录阶段耗时字段（按路径可选），用于定位瓶颈与回归比较。
执行基于向量检索的 context 解析时，日志 MUST 包含 `embed_ms` 与 `search_ms`；若发生 DB 加载与格式化，则 MUST 包含 `db_ms` 与 `format_ms`。

### Requirement: Standardized error classification
系统 MUST 在生成失败时记录标准化的错误分类字段 `error_kind`，并记录重试配置与是否触发 fallback。
模型调用失败并触发 fallback 时，日志 MUST 包含 `error_kind`、`agent_retries` 与 `fallback=true`。

### Requirement: Cache hit/miss observability (vector search)
当生成链路使用向量检索缓存时，系统 MUST 记录 cache hit/miss，并尽可能携带 `trace_id` 以便关联。
向量检索命中缓存时 MUST 记录 cache hit；未命中时 MUST 记录 cache miss，并尽可能携带 `trace_id`。
