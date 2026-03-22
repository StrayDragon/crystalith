## Why

当前工作流还是偏“人一步步点过去”。这对早期探索没有问题，但一旦任务变长、来源变多、结果要反复比较，用户就会想把它变成一个能暂停、能恢复、能追踪的研究任务。

## What Changes

- 引入 mission brief 和 research run，把一次复杂研究拆成可跟踪的多步任务。
- 支持计划、执行、检查点、恢复和最终交付，而不是只保留单次请求结果。
- 把搜索、抓取、比对、生成和审阅串成可观察的任务链路。
- 允许用户在关键节点接管，而不是被迫从头手工重做。

## Capabilities

### New Capabilities

- `agentic-research-runs`: 定义多步研究任务、检查点和恢复语义。

### Modified Capabilities

- `background-jobs-and-task-runtime`: 需要支持更长生命周期的任务和检查点。
- `generation-core`: 需要明确 run 内部生成步骤与产物的挂接关系。
- `source-aware-generation-modes`: 需要支持任务级来源策略，而不只是单次请求策略。
- `workspace-command-registry`: 需要提供 run 的启动、暂停、恢复和查看入口。

## Impact

- Backend：任务状态机、检查点存储、编排器和执行日志。
- Frontend：Run 列表、任务详情、进度视图和接管入口。
- Dependencies：这条线更偏中期能力，建议在 `c00-workspace-object-model-and-readiness-contract` 与前面几层产品闭环先成形之后再拉高优先级，否则 run、artifact、session 的边界很容易反复返工。
