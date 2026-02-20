# vector-search-cache Specification

## Purpose
TBD - created by archiving change vector-search-cache-consistency. Update Purpose after archive.
## Requirements
### Requirement: Versioned vector search cache keys
系统 MUST 使用版本化（epoch）cache key 缓存向量检索结果，使得向量集合变更后旧缓存自然失效，无需扫描删除。

#### Scenario: key 包含 epoch
- **WHEN** 系统写入一次向量检索缓存
- **THEN** 缓存 key 组成包含当前 notebook 的 `vector_epoch`

### Requirement: Bump epoch on vector mutations
系统 MUST 在任何改变 notebook 向量集合的写操作后 bump 对应 notebook 的 `vector_epoch`。

#### Scenario: re-embed 触发 bump
- **WHEN** 用户对某个 source 执行 re-embed
- **THEN** 系统 bump 该 notebook 的 `vector_epoch`

#### Scenario: delete 触发 bump
- **WHEN** 用户删除 source（或 notebook）
- **THEN** 系统 bump 该 notebook 的 `vector_epoch`

### Requirement: Epoch change invalidates prior cached searches
系统 MUST 保证 epoch 变化后，之前 epoch 下写入的检索缓存不再被命中。

#### Scenario: bump 后旧缓存不命中
- **WHEN** epoch bump 发生
- **THEN** 后续相同 query 的检索不再命中旧 epoch 的缓存 key

### Requirement: Vector search cache TTL
系统 MUST 为向量检索缓存设置 TTL，避免旧 epoch 的缓存无限累积。

#### Scenario: TTL 到期后缓存过期
- **WHEN** 向量检索缓存超过 TTL
- **THEN** 缓存过期不再命中
