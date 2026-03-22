## Why

用户搜同一批东西时，意图并不总一样。有时候想找概览，有时候想找证据，有时候想专门找反例。没有检索意图预设，搜索虽然统一了，但还不够顺手。

## What Changes

- 定义 retrieval intent preset，为常见检索意图提供稳定 lens。
- 支持 query lens，例如概览 lens、证据 lens、反例 lens、时间变化 lens。
- 让不同 lens 明确各自偏好的排序因子、过滤条件和解释方式。
- 保持 lens 可组合，但不把用户推进过多复杂配置。

## Capabilities

### New Capabilities
- `retrieval-intent-presets-and-query-lens`: 定义检索意图预设、查询镜头和对应解释语义。

### Modified Capabilities
- `unified-search-query-and-rerank`: 需要支持 lens 级查询与结果呈现。
- `retrieval-query-trace-and-search-replay`: 查询轨迹需要记录所用 lens。
- `saved-searches-smart-filters-and-follow-lists`: 保存搜索需要能保存 lens。

## Impact

- Backend：会影响检索装配、排序逻辑和查询解释。
- Frontend：会影响搜索入口、lens 选择和结果说明。
- Dependencies：这条线接在 `c255` 后面，是检索从“能搜”走向“按意图搜”。
