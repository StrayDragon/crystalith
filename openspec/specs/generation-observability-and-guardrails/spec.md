# generation-observability-and-guardrails Specification

## Purpose

定义生成链路的可观测性与运行护栏：trace 关联、阶段耗时、错误分类、并发限制、重试边界与任务队列行为。

## Non-goals

- 不定义具体业务输出格式
- 不定义前端渲染细节

## Requirements

### Requirement: Each generation request has a trace_id
每次生成请求 MUST 有可关联 `trace_id`，并贯穿关键日志。

#### Scenario: Logs are traceable
- **WHEN** 系统处理一次生成请求并输出关键日志
- **THEN** 这些日志 SHALL 关联同一个 `trace_id`

### Requirement: Stage timing fields are standardized
关键阶段日志 MUST 记录标准化耗时字段（如 embed/search/db/format）。

#### Scenario: Timing fields are present
- **WHEN** 生成链路经过 embed/search/db/format 等关键阶段
- **THEN** 系统 SHALL 在日志中记录标准化耗时字段

### Requirement: Error classification is normalized
失败日志 MUST 记录标准错误分类字段（如 `error_kind`）与重试/fallback 信息。

#### Scenario: Failure logs include classification
- **WHEN** 生成请求失败
- **THEN** 系统 SHALL 记录 `error_kind` 等分类字段以及重试/fallback 信息

### Requirement: Cache hit/miss is observable
使用检索缓存时 MUST 记录 hit/miss，并尽可能携带 trace_id。

#### Scenario: Cache decision is observable
- **WHEN** 系统读取检索缓存并发生命中或未命中
- **THEN** 系统 SHALL 记录 hit/miss，并尽可能携带 `trace_id`

### Requirement: Retry boundaries are not stacked
同一失败链路 MUST 避免多层叠加重试导致放大延迟。

#### Scenario: Retries do not amplify latency
- **WHEN** 上游与下游组件都具备重试能力
- **THEN** 系统 SHALL 只在明确边界执行重试而非层层叠加

### Requirement: Concurrency and cancellation guardrails are enforced
生成与后台任务 MUST 有阶段级并发上限与取消语义。

#### Scenario: Concurrency limits are enforced
- **WHEN** 并发请求超过阶段级上限或用户发起取消
- **THEN** 系统 SHALL 按上限进行限流/排队，并按取消语义停止相关任务

### Requirement: Background workers shutdown gracefully
后台任务队列 worker MUST 支持优雅停机与终态等待行为。

#### Scenario: Worker shutdown is graceful
- **WHEN** worker 收到停机信号
- **THEN** worker SHALL 进行优雅停机并等待任务到达可接受的终态
