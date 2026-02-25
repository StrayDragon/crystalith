# source-ingestion (delta) Specification

## ADDED Requirements

### Requirement: Epoch bumps MUST be atomic and monotonic under concurrency
系统 MUST 保证 `sources_epoch` 与 `vector_epoch` 的 bump 在并发下为原子操作，并保持单调递增（不丢失递增）。

#### Scenario: Concurrent bumps do not lose increments
- **WHEN** 两个或多个并发请求对同一 notebook 触发 epoch bump
- **THEN** 最终 epoch 值按递增次数增长，且不会出现丢失更新
