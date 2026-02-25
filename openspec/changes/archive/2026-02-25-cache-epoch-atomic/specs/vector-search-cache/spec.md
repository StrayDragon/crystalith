# vector-search-cache (delta) Specification

## ADDED Requirements

### Requirement: vector_epoch bump MUST be atomic
系统 MUST 以原子方式 bump `vector_epoch`，保证并发写入下 epoch 变化可靠，从而确保旧 epoch 下的检索缓存不会被误命中。

#### Scenario: Atomic bump invalidates prior cache version
- **WHEN** notebook 的向量集合发生变更并触发 `vector_epoch` bump
- **THEN** 新请求使用的新 epoch cache key，且不会与旧 epoch key 冲突
