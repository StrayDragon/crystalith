## Why

`sources_epoch` 与 `vector_epoch` 用于版本化 cache key，实现 O(1) 失效。但当前 epoch bump 实现采用“get → +1 → set”的读改写方式，在并发写入时会丢失递增（两个请求读到相同值并写回同一个 next 值），导致：

- 缓存失效 token 跳过（旧 cache 仍可能被命中）
- 多 worker/高并发 ingest/re-embed/delete 场景下出现“看似成功但 UI/检索仍读到旧数据”的不一致

需要把 epoch bump 变为 **原子递增**，对 Redis 使用 `INCR`，对 in-memory 使用锁保护，实现并发下的单调递增。

## What Changes

- 扩展 CacheProvider 抽象：增加原子递增能力（例如 `incr(key, amount=1, ttl=...) -> int`）。
- 将 `bump_sources_epoch` 与 `bump_vector_epoch` 改为调用原子递增（不再 get+set）。
- 增加回归测试：并发 bump 不丢失递增；epoch 变化后旧 cache key 不再命中。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `source-ingestion`: 明确 epoch bump 在并发下必须保持单调递增，保证 sources 相关缓存失效可靠。
- `vector-search-cache`: 明确 `vector_epoch` bump 的并发原子性要求，保证检索缓存版本化语义正确。

## Impact

- 受影响代码（预计）：
  - `backend/py/src/crystalith/shared/cache/interfaces.py`（新增 incr）
  - `backend/py/src/crystalith/shared/cache/{in_memory,redis_cache}.py`
  - `backend/py/src/crystalith/shared/cache/epochs.py`
  - `backend/py/src/crystalith/shared/vector_storage/cached.py`
  - 相关 pytest（并发与缓存一致性）
- 风险：
  - CacheProvider 协议变更（内部 breaking）；需要同步更新所有实现与调用点。
