## Why

时间线一旦和证据脱节，就只剩漂亮的顺序图。真正有用的是能看见每个时间段后面到底站着哪些来源和证据，必要时还能顺着回去看原文。

## What Changes

- 定义 evidence band，把时间线区段和对应证据簇绑在一起。
- 支持 source drillback，让用户从时间线节点回到来源片段或证据块。
- 区分强证据、辅助证据和待补证据，避免时间线显得过于确定。
- 让时间线不只服务展示，也服务核查和修补。

## Capabilities

### New Capabilities
- `timeline-evidence-bands-and-source-drillback`: 定义时间线证据带、来源回钻和强弱证据分层。

### Modified Capabilities
- `source-coverage-and-evidence-map`: 需要支持时间线维度的证据回链。
- `citation-backfill-and-missing-evidence-repair`: 缺证据时间段需要能发起修补。
- `studio-output-types`: timeline 输出需要支持证据带与回钻。

## Impact

- Backend：会影响 timeline 载荷、证据聚合和回钻接口。
- Frontend：会影响时间线查看器、证据带渲染和回钻交互。
- Dependencies：这条线让 timeline 从“能看”变成“能查”。
