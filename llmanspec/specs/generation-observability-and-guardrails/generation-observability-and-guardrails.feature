# language: zh-CN
# capability: generation-observability-and-guardrails
# purpose: 定义生成链路的可观测性与运行护栏：trace 关联、阶段耗时、错误分类、并发限制、重试边界与任务队列行为。
# scope: src/, tests/

功能: generation-observability-and-guardrails

  @req:r32 @human
  场景: Each generation request has a traceId
    - 每次生成请求 MUST 有可关联 `traceId`，并贯穿关键日志。

  @req:r90 @human
  场景: Stage timing fields are standardized
    - 关键阶段日志 MUST 记录标准化耗时字段（如 embed/search/db/format）。

  @req:r127 @human
  场景: Error classification is normalized
    - 失败日志 MUST 记录标准错误分类字段（如 `errorKind`）与重试/fallback 信息。

  @req:r163 @human
  场景: Cache hit/miss is observable
    - 使用检索缓存时 MUST 记录 hit/miss，并尽可能携带 traceId。

  @req:r198 @human
  场景: Retry boundaries are not stacked
    - 同一失败链路 MUST 避免多层叠加重试导致放大延迟。

  @req:r228 @human
  场景: Concurrency and cancellation guardrails are enforced
    - 生成与后台任务 MUST 有阶段级并发上限与取消语义。

  @req:r251 @human
  场景: Background workers shutdown gracefully
    - 后台任务队列 worker MUST 支持优雅停机与终态等待行为。

  @req:retry-honors-retry-after @human
  场景: Retry MUST honor Retry-After header and include full retryable codes
    - AI 调用重试 MUST 解析并遵守响应的 Retry-After 头，且可重试状态码集合 MUST 包含 408/409/425/429/500/502/503/504

  @req:retry-timeout-budget @human
  场景: Retry MUST enforce timeout budget and max delay
    - AI 调用重试 MUST 实施 total timeout 预算和 max delay 上限，避免无限退避

  @req:r32 @human
  场景: logs-are-traceable
    - 必须成立：当 系统处理一次生成请求并输出关键日志；那么 这些日志 SHALL 关联同一个 `traceId`
    当 系统处理一次生成请求并输出关键日志
    那么 这些日志 SHALL 关联同一个 `traceId`

  @req:r90 @human
  场景: timing-fields-are-present
    - 必须成立：当 生成链路经过 embed/search/db/format 等关键阶段；那么 系统 SHALL 在日志中记录标准化耗时字段
    当 生成链路经过 embed/search/db/format 等关键阶段
    那么 系统 SHALL 在日志中记录标准化耗时字段

  @req:r127 @human
  场景: failure-logs-include-classification
    - 必须成立：当 生成请求失败；那么 系统 SHALL 记录 `errorKind` 等分类字段以及重试/fallback 信息
    当 生成请求失败
    那么 系统 SHALL 记录 `errorKind` 等分类字段以及重试/fallback 信息

  @req:r163 @human
  场景: cache-decision-is-observable
    - 必须成立：当 系统读取检索缓存并发生命中或未命中；那么 系统 SHALL 记录 hit/miss，并尽可能携带 `traceId`
    当 系统读取检索缓存并发生命中或未命中
    那么 系统 SHALL 记录 hit/miss，并尽可能携带 `traceId`

  @req:r198 @human
  场景: retries-do-not-amplify-latency
    - 必须成立：当 上游与下游组件都具备重试能力；那么 系统 SHALL 只在明确边界执行重试而非层层叠加
    当 上游与下游组件都具备重试能力
    那么 系统 SHALL 只在明确边界执行重试而非层层叠加

  @req:r228 @human
  场景: concurrency-limits-are-enforced
    - 必须成立：当 并发请求超过阶段级上限或用户发起取消；那么 系统 SHALL 按上限进行限流/排队，并按取消语义停止相关任务
    当 并发请求超过阶段级上限或用户发起取消
    那么 系统 SHALL 按上限进行限流/排队，并按取消语义停止相关任务

  @req:r251 @human
  场景: worker-shutdown-is-graceful
    - 必须成立：当 worker 收到停机信号；那么 worker SHALL 进行优雅停机并等待任务到达可接受的终态
    当 worker 收到停机信号
    那么 worker SHALL 进行优雅停机并等待任务到达可接受的终态

  @req:retry-honors-retry-after @human
  场景: rate-limit-with-retry-after
    - 必须成立：假如 provider 返回 429 且 Retry-After: 60；当 retry 逻辑处理；那么 系统 SHALL 等待 60 秒后重试而非使用指数退避
    假如 provider 返回 429 且 Retry-After: 60
    当 retry 逻辑处理
    那么 系统 SHALL 等待 60 秒后重试而非使用指数退避

  @req:retry-timeout-budget @human
  场景: bounded-backoff
    - 必须成立：假如 连续多次 503 错误；当 retry 退避计算；那么 退避延迟 SHALL 不超过 max_delay 上限且总时间不超过 total timeout 预算
    假如 连续多次 503 错误
    当 retry 退避计算
    那么 退避延迟 SHALL 不超过 max_delay 上限且总时间不超过 total timeout 预算
