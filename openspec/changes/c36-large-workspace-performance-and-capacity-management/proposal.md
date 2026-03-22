## Why

当前产品还处在能力不断加法的阶段，所以很多性能问题还没完全暴露出来。但只要来源、run、artifact、图谱和协作记录一起增长，Workspace 很快就会碰到“不是不能用，而是越来越钝”的阶段。到那时再补容量治理，代价会比现在高得多。

## What Changes

- 定义 workspace、source、run、artifact、graph 等对象的容量预算和软硬限制。
- 提供大工作区下的渐进加载、热点诊断、分页聚合和后台整理建议，而不是一味把所有数据塞进当前视图。
- 让系统能识别高负载场景，比如超大 notebook、连接器同步积压、重型分析任务竞争和缓存击穿。
- 为用户和管理员提供可执行动作，比如归档建议、重建索引、暂停低优先级任务、限制高成本操作。

## Capabilities

### New Capabilities

- `workspace-performance-and-capacity-management`: 定义容量预算、负载诊断、渐进加载和容量干预动作。

### Modified Capabilities

- `workspace-ui-core`: 需要支持大工作区视图下的渐进展示和容量提醒。
- `retrieval-and-cache`: 需要增加高容量场景下的缓存、重建和退化策略。
- `background-jobs-and-task-runtime`: 需要支持负载感知调度、优先级控制和积压诊断。
- `data-and-storage`: 需要支持容量统计、冷热分布和空间回收信号。

## Impact

- Backend：容量统计、调度策略、缓存治理、索引维护和告警。
- Frontend：大工作区性能提示、容量面板、诊断入口和推荐动作。
- Product：这是很多后续高阶提案的隐形前置，不做它，后面的多工作区、长期监控和 program 能力都容易“理论上成立，体验上拖垮”。
- Dependencies：建议接在 `c16-cross-notebook-insight-graph`、`c17-admin-observability-and-operations-center`、`c29-cost-intelligence-and-model-routing-governance` 之后。
