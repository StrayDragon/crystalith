# vector-search-cache Specification

## Purpose

定义向量检索缓存的一致性策略：通过 `vector_epoch` 版本化 cache key 在向量集合变更后实现 O(1) 失效，并为缓存设置 TTL，避免旧 epoch 数据无限累积。

## Related specs

- `GLOSSARY.md`
- `vector-storage/spec.md`
- `backend-performance/spec.md`
- `generation-observability/spec.md`
- `generation-retrieval/spec.md`

## Requirements
### Requirement: Versioned vector search cache keys
系统 MUST 使用版本化（epoch）cache key 缓存向量检索结果，使得向量集合变更后旧缓存自然失效，无需扫描删除。
缓存 key 组成 MUST 包含当前 notebook 的 `vector_epoch`。

### Requirement: Bump epoch on vector mutations
系统 MUST 在任何改变 notebook 向量集合的写操作后 bump 对应 notebook 的 `vector_epoch`。
例如：re-embed、删除 source（或 notebook）等操作 MUST bump `vector_epoch`。

### Requirement: vector_epoch bump MUST be atomic
系统 MUST 以原子方式 bump `vector_epoch`，保证并发写入下 epoch 变化可靠，从而确保旧 epoch 下的检索缓存不会被误命中。

### Requirement: Epoch change invalidates prior cached searches
系统 MUST 保证 epoch 变化后，之前 epoch 下写入的检索缓存不再被命中。

### Requirement: Vector search cache TTL
系统 MUST 为向量检索缓存设置 TTL，避免旧 epoch 的缓存无限累积。
