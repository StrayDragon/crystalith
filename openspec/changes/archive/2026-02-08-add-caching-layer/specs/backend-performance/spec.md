## ADDED Requirements

### Requirement: Cache Provider Interface
系统 SHALL 提供统一的缓存抽象接口（CacheProvider），支持 get、set、delete 和基于模式的批量失效操作。系统 MUST 提供至少两种实现：InMemoryCache（默认）和 RedisCache（可选）。

#### Scenario: 内存缓存读写
- **WHEN** 使用 InMemoryCache 写入一个键值对并立即读取
- **THEN** 返回写入的值

#### Scenario: 缓存 TTL 过期
- **WHEN** 写入一个键值对并等待超过 TTL 时间后读取
- **THEN** 返回 None / 缓存未命中

#### Scenario: 缓存模式失效
- **WHEN** 调用 invalidate_pattern 传入通配模式
- **THEN** 所有匹配该模式的缓存键被删除

### Requirement: Query Result Caching
系统 SHALL 对 notebook 列表、source 列表和 chunk 检索等高频读取路径的查询结果进行缓存。缓存 MUST 在对应数据发生变更（创建、更新、删除）时自动失效。

#### Scenario: Source 列表缓存命中
- **WHEN** 连续两次请求同一 notebook 的 source 列表，且期间无数据变更
- **THEN** 第二次请求从缓存返回，不查询数据库

#### Scenario: Source 变更触发缓存失效
- **WHEN** 向 notebook 添加新 source 后请求 source 列表
- **THEN** 缓存已失效，返回包含新 source 的最新列表

### Requirement: Cache Configuration
系统 SHALL 在配置文件中支持缓存相关配置项，包括 provider 类型、TTL、最大缓存大小和 Redis 连接信息（可选）。

#### Scenario: 默认缓存配置
- **WHEN** 配置文件中未指定 cache 段
- **THEN** 系统使用 InMemoryCache 并采用默认 TTL 和大小限制
