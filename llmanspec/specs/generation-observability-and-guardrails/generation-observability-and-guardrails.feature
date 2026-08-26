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
    - 同一失败链路 MUST 只在明确边界执行重试，避免多层叠加重试导致放大延迟。AI 重试由 middleware 统一承载，职责见 architecture-plugin-and-agent r247。

  @req:r228 @human
  场景: Concurrency and cancellation guardrails are enforced
    - 生成与后台任务 MUST 有阶段级并发上限与取消语义：超过上限的请求 MUST 被限流或排队，取消 SHALL 按取消语义停止相关任务。

  @req:r251 @human
  场景: Background workers shutdown gracefully
    - 后台任务队列 worker MUST 支持优雅停机，并等待任务到达可接受的终态。

  @req:retry-honors-retry-after @human
  场景: Retry MUST honor Retry-After header and include full retryable codes
    - AI 调用重试 MUST 解析并遵守响应的 Retry-After 头（命中时按其指示等待而非使用指数退避），且可重试状态码集合 MUST 包含 408/409/425/429/500/502/503/504

  @req:retry-timeout-budget @human
  场景: Retry MUST enforce timeout budget and max delay
    - AI 调用重试 MUST 实施 total timeout 预算和 max delay 上限（退避延迟不超过 max_delay、总时间不超过 total timeout），避免无限退避。本条与 retry-honors-retry-after 共为 AI 调用重试策略的 canonical 约束（职责承载见 architecture-plugin-and-agent r247）。
