## Why

随着 run、artifact、briefing、审阅记录和历史来源越来越多，系统迟早会遇到一个很现实的问题：哪些对象应该一直热着，哪些对象只是留档，哪些对象应该随取随恢复。现在如果只有“留着”或“删掉”两种选择，既不经济，也不利于长期治理。

## What Changes

- 引入 hot / warm / cold / archive 等生命周期层级，让不同对象按价值和访问频率进入不同存储层。
- 支持按 tenant、workspace、artifact 类型或时间窗口设置归档与冷存策略，而不是全局一刀切。
- 允许用户在历史对象需要时恢复到可读、可审或可再发布状态，而不是把归档等同于永久不可用。
- 把归档状态纳入 Workspace 可见语义，明确哪些内容是在线工作对象，哪些是历史资产。

## Capabilities

### New Capabilities

- `tiered-archive-and-cold-storage`: 定义分层存储、归档恢复、对象可见性和生命周期策略。

### Modified Capabilities

- `data-and-storage`: 需要支持分层存储状态、恢复任务和空间回收规则。
- `publishable-artifacts`: 需要明确发布对象在归档、撤回和恢复时的状态变化。
- `workspace-api-contract`: 需要增加归档查询、恢复请求和生命周期摘要接口。
- `delivery-and-deployment`: 需要定义不同部署形态下哪些分层策略可用、如何配置。

## Impact

- Backend：归档任务、分层存储元数据、恢复流程和成本优化逻辑。
- Frontend：归档标识、筛选视图、恢复入口和生命周期说明。
- Operations：这会把长期保存和在线工作拆开，明显缓解容量、成本和治理压力。
- Dependencies：建议接在 `c23-artifact-versioning-and-release-channels`、`c35-workspace-backup-migration-and-recovery`、`c36-large-workspace-performance-and-capacity-management` 之后。
