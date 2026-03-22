## Why

多人协作一旦变多，团队最容易丢的不是内容，而是“为什么当时这么判”。如果每次 review、退回、批准、忽略都只留在零散评论里，后面同样的问题还会重复吵一遍。Crystalith 需要把这些判断沉淀成可追溯的决策记忆。

## What Changes

- 引入 decision ledger，把审阅意见、批准原因、风险接受、例外处理和发布备注沉淀成结构化记录。
- 支持把 review note 从单次结果页面抽出来，形成可复用的 decision pattern，例如“某类来源必须二次核查”“某类说法对外不可直发”。
- 允许用户按 artifact、workspace、审批请求、来源类型和时间线回看关键判断，而不是只看当前页评论。
- 让主动建议、质量中心和后续版本发布能引用历史判断，而不是每次重新开始。

## Capabilities

### New Capabilities
- `review-memory-and-decision-ledger`: 定义结构化决策记录、例外理由、复用规则和历史回看能力。

### Modified Capabilities
- `evidence-review-workflow`: 需要把 review note 扩展为可沉淀、可追溯、可复用的决策记录对象。
- `quality-gates-for-generation`: 需要支持将质量异常与人工决策结果关联，避免告警长期失忆。
- `publishable-artifacts`: 需要让产物页可查看历史决策上下文，而不是只看当前状态。
- `workspace-api-contract`: 需要提供 decision ledger 查询、筛选和关联对象检索接口。

## Impact

- Backend：决策日志模型、关联索引、模式抽取和查询接口。
- Frontend：决策时间线、复盘页、过滤器和关联对象跳转。
- Governance：这会给协作、审批和对外发布补上一层真正能复盘的“组织记忆”。
- Dependencies：建议接在 `c04-evidence-gap-and-claim-checking`、`c08-multiplayer-review-workspace`、`c14-approval-flows-and-audit-trails` 之后。
