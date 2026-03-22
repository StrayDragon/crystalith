## Why

缓存问题最难受的地方通常是：你怀疑它有问题，但看不见它现在到底在哪个 epoch，也不知道一旦清了会影响多大。没有检查和预览，缓存失效操作总显得很莽。

## What Changes

- 定义 cache epoch inspection，展示关键缓存域当前的 epoch 与最近变化。
- 支持 invalidation preview，在真正清理前预估会影响哪些对象和路径。
- 区分局部失效和全局失效，避免一有问题就一锅端。
- 让缓存预览既服务调试，也服务来源刷新、检索诊断和回归清理。

## Capabilities

### New Capabilities
- `cache-epoch-inspection-and-invalidation-preview`: 定义缓存 epoch 检查、失效预览和作用范围语义。

### Modified Capabilities
- `retrieval-and-cache`: 需要暴露 epoch 与失效范围。
- `search-index-incremental-refresh-and-staleness-diagnostics`: 索引陈旧诊断需要消费缓存 epoch 信息。
- `quality-and-regression`: 回归前清理需要有可见预览。

## Impact

- Backend：会影响 cache 元数据、失效预览和调试接口。
- Frontend：会影响诊断面板和清理前确认视图。
- Dependencies：这条线是维护层的基础设施，但直接改善排错体验。
