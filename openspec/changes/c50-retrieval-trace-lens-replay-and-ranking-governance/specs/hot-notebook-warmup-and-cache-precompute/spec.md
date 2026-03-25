# hot-notebook-warmup-and-cache-precompute 规范增量

## ADDED Requirements

### Requirement: Warmup MUST Target High-value Retrieval Cold Paths Only
系统 MUST 将 warmup 限定在高价值冷路径，而不是无边界地预热所有 notebook 或所有查询。

#### Scenario: notebook 刚被打开或关键数据刚更新
- **WHEN** 系统决定为某个 notebook 执行 warmup
- **THEN** SHALL 只针对高价值 retrieval targets 做预热
- **AND** SHALL 遵守预算与 guardrails

### Requirement: Warmup MUST Run as a Controlled Background Activity
系统 MUST 将 warmup 视为受控 background work，而不是长期占资源的隐形任务。

#### Scenario: 系统在后台执行 cache precompute
- **WHEN** warmup runner 被触发
- **THEN** 系统 SHALL 让其运行在 background lane 或等价低优先级路径
- **AND** SHALL 在压力升高时可退避、暂停或缩减
