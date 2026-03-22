## Why

用户在启动一个长 run 前，最想知道的是两件事：大概要多久，过程中能不能打断。没有这个预期，长任务要么显得冒险，要么显得不受控。

## What Changes

- 定义 run cost/time estimate，在启动前给出粗略耗时和复杂度预期。
- 增加 interrupt point，明确哪些阶段适合暂停、确认或用户接管。
- 区分乐观预估和保守预估，避免把估算包装成承诺。
- 让预估结果和中断点一起进入 run 详情，而不是启动后就消失。

## Capabilities

### New Capabilities
- `run-cost-time-estimates-and-interrupt-points`: 定义 run 耗时预估、中断点和接管窗口语义。

### Modified Capabilities
- `agentic-research-runs`: run 启动前后需要消费预估和中断点。
- `background-jobs-and-task-runtime`: 需要支持阶段级中断点暴露。
- `concurrency-budgets-and-backpressure-visibility`: 预估需要消费队列和预算信息。

## Impact

- Backend：会影响预估逻辑、任务阶段元数据和详情接口。
- Frontend：会影响 run 启动提示、详情页和接管入口。
- Dependencies：这条线和 `c265` 类似，但对象从来源导入换成了长任务执行。
