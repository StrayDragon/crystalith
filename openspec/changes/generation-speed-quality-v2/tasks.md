## 1. Cache 批量接口

- [x] 1.1 扩展 `CacheProvider` 支持 `get_many` / `set_many`
- [x] 1.2 为 InMemoryCache 实现批量读写（单锁保证 TTL/LRU 语义）
- [x] 1.3 为 RedisCache 实现批量读写（MGET + pipeline SET）
- [x] 1.4 补充批量缓存单测覆盖（顺序对齐、TTL/缺失项）

## 2. 向量检索多查询缓存批量化

- [x] 2.1 将 `cached_vector_search_many` 改为批量读取缓存并收敛 miss 集合
- [x] 2.2 miss 结果通过 `search_many` 一次性查询（如可用），并批量写回缓存
- [x] 2.3 补充 `cached_vector_search_many` 行为单测（第二次调用不再触发 vector search）

## 3. 输出类型 + preference 的默认调参入口

- [x] 3.1 新增 `tuning_for_request(output_type, preference)`（tool 类型在质量模式下轻量增益）
- [x] 3.2 输出生成（outputs）在未显式传参时使用该默认调参
- [x] 3.3 Slides 生成在未显式传参时使用该默认调参（保持显式参数优先）
