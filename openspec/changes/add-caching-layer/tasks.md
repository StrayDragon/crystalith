## 1. 缓存抽象层
- [ ] 1.1 定义 CacheProvider 接口（get/set/delete/invalidate_pattern）
- [ ] 1.2 实现 InMemoryCache（基于 TTL 的内存缓存，LRU 淘汰策略）
- [ ] 1.3 实现 RedisCache（可选依赖，通过配置切换）
- [ ] 1.4 编写 CacheProvider 接口的单元测试

## 2. 缓存配置
- [ ] 2.1 在 config schema 中新增 cache 配置段（provider, ttl, max_size, redis_url）
- [ ] 2.2 实现缓存配置加载与验证
- [ ] 2.3 编写缓存配置验证测试

## 3. Service 层缓存集成
- [ ] 3.1 Notebook 列表查询添加缓存
- [ ] 3.2 Source 列表/详情查询添加缓存
- [ ] 3.3 Chunk 检索结果添加缓存
- [ ] 3.4 Source 变更时自动失效关联缓存
- [ ] 3.5 编写缓存命中/失效的集成测试

## 4. 验证
- [ ] 4.1 对比缓存前后的 API 响应时间（手动基准测试）
- [ ] 4.2 验证 source 更新/删除后缓存正确失效
- [ ] 4.3 验证内存缓存的 LRU 淘汰和 TTL 过期行为
