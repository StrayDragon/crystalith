## 1. Epoch-based cache key

- [x] 1.1 实现 `vector_epoch` 的 get/bump helper（key: `notebook:{id}:vector_epoch`）
- [x] 1.2 将 `vector_epoch` 纳入 `cached_vector_search` 的 cache key 组成（避免旧 epoch 命中）
- [x] 1.3 为 vector_search 缓存设置独立 TTL（避免 key 积累）

## 2. Write-path invalidation triggers

- [x] 2.1 将 source ingest/re-embed/delete 等写路径从 `invalidate_pattern(notebook:{id}:vector_search:*)` 迁移为 bump epoch
- [x] 2.2 盘点并补齐所有会改变向量集合的路径（包括 convert-to-source 等），确保均触发 bump

## 3. Transition cleanup

- [x] 3.1 评估是否保留 vector_search 的 pattern invalidation 兜底；如保留，限制为低频/开发用途
- [x] 3.2 更新相关日志字段，便于观测 epoch 与命中率

## 4. Verification

- [x] 4.1 单测：epoch bump 后旧 key 不再命中；TTL 生效
- [x] 4.2 回归：Redis 场景下写路径不触发 SCAN 删除大量键（性能与稳定性对比）
  - 记录：Redis `MONITOR` 观察到写路径 `SCAN MATCH notebook:{id}:sources:*` + `GET/SET notebook:{id}:vector_epoch`；未出现 `SCAN ... vector_search:*`，vector_search key 以 `v{epoch}` 版本化并使用 `EX 300`。
