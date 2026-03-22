## Why

真正有价值的搜索，很多不是一次搜完就结束，而是会反复回来。没有保存搜索和关注列表，用户每次都得重新拼一遍条件，时间一长就会放弃那些本来很有复利的筛选。

## What Changes

- 定义 saved search，保存稳定可复用的搜索条件、排序和过滤组合。
- 支持 smart filter，让搜索能带上时间范围、来源质量、标签和工作桶条件。
- 增加 follow list，让用户关注一组主题、实体或对象集合，并在变化时回看。
- 让保存搜索既能服务全局搜索，也能服务首页卡片和每日回看。

## Capabilities

### New Capabilities
- `saved-searches-smart-filters-and-follow-lists`: 定义保存搜索、智能筛选和关注列表语义。

### Modified Capabilities
- `unified-search-query-and-rerank`: 需要支持保存搜索和关注视图。
- `workspace-home-and-operating-cockpit`: 首页需要能挂接保存搜索结果。
- `workspace-notification-center-and-snooze-rules`: 关注列表变化需要能进入提醒流。

## Impact

- Backend：会影响搜索条件对象、关注列表和变化检测。
- Frontend：会影响搜索页、筛选器、关注入口和首页卡片。
- Dependencies：这条线是 `c200` 的自然补件，也能让 `c165` 首页更有抓手。
