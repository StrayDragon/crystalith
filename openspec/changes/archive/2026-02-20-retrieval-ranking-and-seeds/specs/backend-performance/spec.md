## ADDED Requirements

### Requirement: Multi-query Cost Controls
系统 MUST 在 multi-query 场景下提供成本控制点（至少包括 seeds 上限与可观测的 query_count），并将其纳入默认 tuning。

#### Scenario: 记录 query_count
- **WHEN** 系统执行 multi-query 检索
- **THEN** 日志/指标 MUST 记录 query_count（实际 seeds 数）

### Requirement: Optional Retrieval Assembly Cache
系统 MAY 提供短 TTL 的检索组装缓存（在安全边界内），用于降低重复检索/格式化的开销。

#### Scenario: 相同输入命中缓存
- **GIVEN** 在短时间内重复以相同 notebook_id/source_ids/seeds 等参数请求检索
- **WHEN** 第二次请求发生
- **THEN** 系统 MAY 从缓存返回等价的检索结果并减少 DB/format 开销
