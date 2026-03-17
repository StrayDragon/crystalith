## Why

时间线一旦和证据脱节，就只剩漂亮的顺序图。真正有用的是能看见每个时间段后面到底站着哪些来源和证据，必要时还能顺着回去看原文。

很多主题不是围绕观点，而是围绕事件演进。来源里时间信息常常分散、含糊，甚至互相矛盾；如果没有一个专门做“事件时间重建 + 顺序推断”的工作面，用户很难把碎片拼成可靠的事件顺序。

## What Changes

- 定义 evidence band，把时间线区段和对应证据簇绑在一起。
- 支持 source drillback，让用户从时间线节点回到来源片段或证据块。
- 区分强证据、辅助证据和待补证据，避免时间线显得过于确定。
- 让时间线不只服务展示，也服务核查和修补。
- 定义 source timeline reconstruction，从多个来源片段中提取事件、时间点和前后关系。
- 增加 event ordering，帮助用户在缺精确时间时也能先排出相对顺序。
- 支持对时间冲突和不确定区间做显式标记，而不是强行给出单一时间线。
- 让重建结果能回接到时间线证据带、问题线程和 briefing。

## Capabilities

### New Capabilities
- `timeline-evidence-bands-and-source-drillback`: 定义时间线证据带、来源回钻和强弱证据分层。
- `source-timeline-reconstruction-and-event-ordering`: 定义事件重建、顺序推断和时间不确定性表达。

### Modified Capabilities
- `source-coverage-and-evidence-map`: 需要支持时间线维度的证据回链。
- `citation-backfill-and-missing-evidence-repair`: 缺证据时间段需要能发起修补。
- `studio-output-types`: timeline 输出需要支持证据带与回钻。
- `question-led-research-threads-and-answer-status`: 问题线程需要支持事件顺序类问题。
- `consensus-outlier-detection-across-sources`: 共识视图需要能识别时间排序分歧。

## Impact

- Backend：会影响 timeline 载荷、事件抽取、相对顺序推断、证据聚合与回钻接口。
- Frontend：会影响时间线查看器/编辑器、来源对照、证据带渲染、回钻交互与不确定区间展示。
- Dependencies：这条线让 timeline 从“能看”变成“能查”，并建议与 `c2105`（问题线程）和 `c2094`（共识/离群）对齐时间型问题的语义与分歧表达。

```mermaid
flowchart LR
  S[Sources/Chunks] --> R[Event reconstruction + ordering]
  R --> T[Timeline evidence bands]
  T --> D[Drillback to evidence]
```
