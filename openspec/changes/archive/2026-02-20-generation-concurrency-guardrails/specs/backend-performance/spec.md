## ADDED Requirements

### Requirement: Stage-level Concurrency Limits
系统 MUST 为关键 I/O 阶段提供并发限制（至少包括 embedding、vector search、LLM generation），并允许通过配置调整上限。

#### Scenario: embedding 并发受限
- **GIVEN** 配置设置 embedding 并发上限为 N
- **WHEN** 同时触发超过 N 个 embedding 请求
- **THEN** 系统 MUST 限制并发执行数不超过 N（其余请求等待或排队）

#### Scenario: limiter 等待可观测
- **WHEN** 请求因 limiter 等待而延迟
- **THEN** 系统 SHOULD 记录等待耗时（用于性能分析）

### Requirement: Cancellation Avoids Wasteful Work
系统 SHOULD 在请求取消时尽早停止后续阶段，减少无效计算与资源占用。

#### Scenario: 请求取消后停止生成
- **WHEN** 客户端断开或请求被取消
- **THEN** 系统 SHOULD 尽早停止尚未开始的阶段
