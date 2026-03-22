## Why

个人工作台里最难管的，往往不是一个个对象本身，而是“这些东西现在该去哪一桶”。如果只有来源、输出、笔记三类对象，没有一层面向自己的工作队列，日常推进很容易散。

## What Changes

- 定义 personal work queue，把待读、待补、待整理、待确认和待发布这类个人工作桶收成正式对象。
- 支持对象跨桶流转，而不是只能靠标签和记忆维持顺序。
- 让 queue 既能承接来源、输出，也能承接 scratchpad 和 return point。
- 让工作桶的存在感足够轻，不把个人工作台做成项目管理系统。

## Capabilities

### New Capabilities
- `personal-work-queues-and-review-buckets`: 定义个人工作队列、复盘桶和对象流转语义。

### Modified Capabilities
- `daily-review-resurfacing-and-deferred-items`: 每日回看需要消费工作桶。
- `workspace-home-and-operating-cockpit`: 首页需要呈现主要工作桶摘要。
- `workspace-api-contract`: 需要增加工作桶查询与流转接口。

## Impact

- Backend：会影响对象聚合、队列流转和摘要接口。
- Frontend：会影响首页、批处理和队列视图。
- Dependencies：这条线承接 `c180`，解决的是“每天要处理的东西放哪儿”。
