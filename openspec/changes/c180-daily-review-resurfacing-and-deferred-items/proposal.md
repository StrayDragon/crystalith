## Why

个人工作台最容易积压的不是大任务，而是那些“先放一下”的小事。没有一个每天能把延后项重新带回视野的机制，东西会慢慢沉下去，最后等于丢了。

## What Changes

- 定义 daily review 语义，把延后项、未完成输出、待补证据和待整理来源集中回看。
- 支持 resurfacing 规则，让被搁置的对象按时间和优先级重新浮上来。
- 区分真正过期和只是还没轮到，避免把所有旧对象都打成问题。
- 让用户能快速继续、再次延后或正式归档，而不是只能一直挂着。

## Capabilities

### New Capabilities
- `daily-review-resurfacing-and-deferred-items`: 定义延后项回看、重新浮现和每日复盘语义。

### Modified Capabilities
- `workspace-notification-center-and-snooze-rules`: 延后规则需要能进入每日复盘。
- `workspace-home-and-operating-cockpit`: 首页需要承接每日回看入口。
- `workspace-api-contract`: 需要增加延后项查询与回看接口。

## Impact

- Backend：会影响延后项聚合、回看规则和状态流转。
- Frontend：会影响首页卡片、每日复盘面板和批量处理入口。
- Dependencies：这条线是 `c175` 的延续，不是新提醒系统，而是提醒之后怎么回收。
