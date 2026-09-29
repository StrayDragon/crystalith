---
depends_on: []
---

# B 组收口：r101/r416 小实现照做 + 四条与架构不符条款移除

## Why

B 组（workspace-ui-panels 5 + r101）是裸规则战役最后的可行动组。逐条核查后按既定原则处置：两条**部分实现 → 小实现达标**（r101 队列条件轮询、r416 面板级错误快照，均有真实用户价值）；四条**移除**——r405（消息内 tool 卡与 r350 纯文本 content / Rivu-dropped 架构决策冲突，agent 工具不进消息 parts）、r411（all/selected/history 三 tab 是无排期 UX 蓝图，现单列表+checkbox 已满足功能）、r413（状态派生需 server 消息状态字段 + 重连语义，双层 spec-ahead）、r417（「仅入列不上传」制造纯客户端假条目，与来源=服务端实体的架构不符）。

## What Changes

- **r101 照做**：`useResearchTasks` 增加条件轮询——新导出纯函数 `researchQueuePollInterval(activeCount)`（非终态存在 → 5s 短间隔，否则 0 停止），SWR `refreshInterval` 接入；打开时拉取（SWR key）与操作后立即刷新（controller 各事件 `refreshResearchTasks`）已有实现，场景一并锁定。
- **r416 照做**：SourcesPanelView 头部错误摘要条——聚合 `uploadQueue` 中 error 项与 `sources` 中 failed 来源，显示失败总数与首条错误消息摘要（列表项图标保留）。
- **移除**：r405 / r411 / r413 / r417 四个规则块（workspace-ui-panels）。
- **specs**：r101/r416 场景化锚定新测试。pending 47 → 41（2 场景化 + 4 移除），B 组清零——战役达成删除条件（仅剩有据豁免），作战地图转纯记录态。

## Impact

- 行为面：队列在有活动 Run 时自动轮询刷新（此前需手动/聚焦触发）；来源面板头部新增失败摘要显示。均为增量 UI，无 wire 变更。
- 移除的条款均为与现架构冲突或无排期的 spec-ahead，不损失现有行为。
