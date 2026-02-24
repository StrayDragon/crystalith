## 1. CacheProvider 原子递增能力

- [x] 1.1 扩展 `CacheProvider` 协议：新增 `incr(key, amount=1, ttl=...) -> int`
- [x] 1.2 为 `InMemoryCache` 实现 `incr`（在同一把锁内读改写，ttl=0 表示不设置过期）
- [x] 1.3 为 `RedisCache` 实现 `incr`（使用 `INCRBY`；如需要支持 ttl>0，补充 `EXPIRE`）

## 2. 迁移 epoch bump 调用点

- [x] 2.1 将 `bump_sources_epoch` 从 get+set 改为 `cache.incr(..., ttl=0)`
- [x] 2.2 将 `bump_vector_epoch`（vector search cache）从 get+set 改为 `cache.incr(..., ttl=0)`
- [x] 2.3 全仓库搜索并迁移任何残留的 epoch get+set 模式，确保一致性

## 3. 自动化测试（并发不丢失递增）

- [x] 3.1 新增单测：对同一 key 并发执行多次 bump，断言最终值等于递增次数（至少覆盖 in-memory）
- [x] 3.2 若 CI/本地可用 Redis，增加可选集成测试覆盖 Redis 原子性（否则通过 mock/contract test 覆盖）
- [x] 3.3 运行：`cd backend/py && just test`（371 passed，coverage 85.33%）

## 4. 手动验收（部署后 + DevTools）

- [x] 4.1 提供部署后手动验收清单（DevTools / Network）

### 部署后手动验收清单（DevTools / Network）

- 启动后端：`cd backend/py && uv sync && just dev`
- 并发触发两次会改变 sources/vector 的操作（例如并发导入两个 sources 或并发删除/重嵌入）
- 在浏览器 DevTools → Network 中观察随后请求不会命中旧数据（sources 列表与检索结果能及时刷新）
