# generation-observability-and-guardrails Specification

## Purpose

定义生成链路的可观测性与运行护栏：trace 关联、阶段耗时、错误分类、并发限制、重试边界与任务队列行为。

## Non-goals

- 不定义具体业务输出格式
- 不定义前端渲染细节

## Requirements

### Requirement: Each generation request has a trace_id
每次生成请求 MUST 有可关联 `trace_id`，并贯穿关键日志。

### Requirement: Stage timing fields are standardized
关键阶段日志 MUST 记录标准化耗时字段（如 embed/search/db/format）。

### Requirement: Error classification is normalized
失败日志 MUST 记录标准错误分类字段（如 `error_kind`）与重试/fallback 信息。

### Requirement: Cache hit/miss is observable
使用检索缓存时 MUST 记录 hit/miss，并尽可能携带 trace_id。

### Requirement: Retry boundaries are not stacked
同一失败链路 MUST 避免多层叠加重试导致放大延迟。

### Requirement: Concurrency and cancellation guardrails are enforced
生成与后台任务 MUST 有阶段级并发上限与取消语义。

### Requirement: Background workers shutdown gracefully
后台任务队列 worker MUST 支持优雅停机与终态等待行为。
