## Why

当前系统每次请求都直接查询数据库和向量存储，缺少缓存层。对于频繁访问的 notebook 元数据、source 列表、chunk 检索结果等热数据，每次都重复计算会导致响应延迟增大，尤其在多 source、多 session 的工作区场景下。引入缓存层可显著降低数据库和向量存储压力，提升 API 响应速度。

## What Changes

- 后端引入缓存抽象层（支持内存缓存和 Redis 两种策略）
- 对 notebook 列表、source 列表、chunk 检索结果等高频读取路径添加缓存
- 对 AI 响应结果（相同 query + 相同 source scope）添加可选缓存
- 添加缓存失效策略：source 变更时自动失效关联缓存
- 在配置文件中新增缓存相关配置项

## Impact

- 受影响的规范：新增 `backend-performance`
- 受影响的系统：
  - 后端 service 层（notebook, source, message, qa 等 service）
  - 配置管理（新增缓存配置项）
  - 向量存储查询路径
