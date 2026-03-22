## Why

检索结果一多，最烦的不是没有命中，而是同一类结果换个壳连着出现。没有聚类和重复折叠，用户会花很多时间在“这些其实差不多”的结果上。

## What Changes

- 定义 retrieval result clustering，把相近结果按来源、主题或段落相似度归组。
- 支持 duplicate collapse，对高度重复结果默认折叠，只把代表项先露出来。
- 让用户能展开看组内细节，不把折叠变成信息丢失。
- 让聚类结果回流到搜索、来源阅读和证据地图，而不是只用于结果列表。

## Capabilities

### New Capabilities
- `retrieval-result-clustering-and-duplicate-collapse`: 定义检索结果聚类、重复折叠和组内展开语义。

### Modified Capabilities
- `retrieval-query-trace-and-search-replay`: 查询轨迹需要解释聚类与折叠。
- `unified-search-query-and-rerank`: 搜索需要支持分组结果呈现。
- `source-deduplication-and-canonicalization-pipeline`: 去重结果需要作为聚类输入。

## Impact

- Backend：会影响检索后处理、聚类逻辑和结果摘要。
- Frontend：会影响搜索列表、组视图和展开交互。
- Dependencies：这条线接在 `c255` 和 `c225` 后面，是结果层的降噪。
