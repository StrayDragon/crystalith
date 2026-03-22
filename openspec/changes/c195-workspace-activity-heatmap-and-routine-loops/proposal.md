## Why

长期使用以后，用户会开始想知道自己到底在这套工作台上形成了什么节奏。哪些 notebook 常看不常收尾，哪些来源常导入不常消化，哪些动作每周都在重复。没有这一层，很难把工作方式慢慢调顺。

## What Changes

- 定义 workspace activity heatmap，按时间和对象类型展示使用密度与积压点。
- 支持 routine loop，识别重复工作节奏，例如每日回看、每周来源复查、周期性 briefing 更新。
- 区分帮助用户自我管理的模式信号和纯后台指标，不把热力图做成监控面板。
- 让用户可据此生成更合适的复盘节奏和默认入口。

## Capabilities

### New Capabilities
- `workspace-activity-heatmap-and-routine-loops`: 定义活跃热力、重复工作节奏和自我管理信号。

### Modified Capabilities
- `daily-review-resurfacing-and-deferred-items`: 需要消费重复节奏和延后项模式。
- `workspace-home-and-operating-cockpit`: 首页需要能展示轻量活跃模式摘要。
- `workspace-api-contract`: 需要增加活跃模式与节奏摘要接口。

## Impact

- Backend：会影响活动聚合、模式识别和历史摘要。
- Frontend：会影响热力图视图、节奏提示和首页摘要。
- Dependencies：这条线接在 `c180` 后面，偏长期使用优化，不抢主线入口。
