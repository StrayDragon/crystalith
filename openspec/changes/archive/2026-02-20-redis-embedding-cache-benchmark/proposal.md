## Why

启用 `cache.provider=redis` 后，embedding 共享缓存的命中率与内存占用将直接影响端到端延迟与 Redis 成本。目前缺少标准化的压测/基准工具与可观测指标，难以在上线前快速评估 TTL/max_texts/max_chars 等参数的取舍与风险。

## What Changes

- 增加可重复运行的 embedding cache benchmark 脚本：输出 cache hit/miss、耗时分布、Redis 内存/键数量等摘要
- 为 embedding 缓存增加最小可观测性（统计与日志字段），便于压测时采集
- 补齐文档：如何启用 Redis embedding cache、如何运行 benchmark、如何解读结果并调整参数

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `backend-performance`: 补充“embedding cache 可观测/可基准化”的要求与场景，支持上线前/上线后的数据驱动调参

## Impact

- Backend：新增脚本与少量 wrapper 统计；不改变 API 形状
- Docs：增加 Redis embedding cache 与 benchmark 指南
- 运行脚本需要可用的 Redis（以及可选依赖 `redis`）
