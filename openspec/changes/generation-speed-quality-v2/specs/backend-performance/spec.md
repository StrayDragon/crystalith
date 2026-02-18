## MODIFIED Requirements

### Requirement: Cache Provider Interface
系统 SHALL 提供统一的缓存抽象接口（CacheProvider），支持 get、set、delete、基于模式的批量失效操作，并支持批量读写（get_many / set_many）。系统 MUST 提供至少两种实现：InMemoryCache（默认）和 RedisCache（可选）。

#### Scenario: 内存缓存读写
- **WHEN** 使用 InMemoryCache 写入一个键值对并立即读取
- **THEN** 返回写入的值

#### Scenario: 内存缓存批量读写
- **WHEN** 使用 InMemoryCache 通过 set_many 写入多个键值对
- **AND** 通过 get_many 批量读取这些键
- **THEN** 返回与 keys 等长、按输入顺序对齐的值列表

#### Scenario: 缓存 TTL 过期
- **WHEN** 写入一个键值对并等待超过 TTL 时间后读取
- **THEN** 返回 None / 缓存未命中

#### Scenario: 缓存模式失效
- **WHEN** 调用 invalidate_pattern 传入通配模式
- **THEN** 所有匹配该模式的缓存键被删除
