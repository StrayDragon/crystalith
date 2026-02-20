## ADDED Requirements

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
