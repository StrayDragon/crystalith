## Why

排查复杂工作区问题时，最浪费时间的往往不是修，而是凑上下文。前端状态、任务状态、来源状态、输出状态散在不同地方，没有一个统一的诊断工作面。

## What Changes

- 定义 dev diagnostics workbench，集中展示关键状态面和调试入口。
- 支持 state dump，把前端局部状态、摘要投影和任务上下文打成可检查对象。
- 区分面向开发排查和面向产品诊断的视图，不把所有信息混一层。
- 让诊断工作面能消费缓存、契约漂移和插件就绪检查结果。

## Capabilities

### New Capabilities
- `dev-diagnostics-workbench-and-state-dumps`: 定义开发诊断工作台、状态转储和调试视图边界。

### Modified Capabilities
- `workspace-scenario-fixtures-and-regression-harness`: 场景回放需要能挂接状态转储。
- `cache-epoch-inspection-and-invalidation-preview`: 缓存状态需要进入诊断工作台。
- `plugin-host-smoke-tests-and-readiness-checks`: 插件就绪检查需要被统一承载。

## Impact

- Backend：会影响诊断接口、状态转储结构和调试入口。
- Frontend：会影响诊断面板、状态查看和导出。
- Dependencies：这条线是维护层的中控台，但只服务开发与排查，不是用户功能。
