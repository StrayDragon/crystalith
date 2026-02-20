## ADDED Requirements

### Requirement: Vector search caching avoids high-cost pattern invalidation
系统 MUST 在 Redis 等外部缓存后端场景下避免高成本的 pattern invalidation（SCAN + DEL）作为主要失效方式；向量检索缓存 SHOULD 采用 epoch/version 化 key 的方式实现 O(1) 失效。

#### Scenario: Redis 场景不依赖 SCAN 删除全部 vector_search keys
- **WHEN** 系统使用 RedisCache 作为缓存后端
- **AND** 发生向量集合变更（ingest/re-embed/delete）
- **THEN** 系统通过 bump epoch 触发失效
- **AND** 不需要扫描并删除 `notebook:{id}:vector_search:*` 的所有键
