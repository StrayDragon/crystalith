## Why

如果系统做了越来越多建议、路由和自动化，但从来不回头学习哪些建议真的有用、哪些版本总被打回、哪些路由最浪费，那它就会一直停在“会动”，很难真正变聪明。前两阶段已经积累了 review、审批、质量和使用信号，现在差的是把这些信号接成闭环。

## What Changes

- 建立 learning loop，把 review 结果、审批决策、使用行为、版本表现和成本结果汇总成可学习的反馈信号。
- 支持对 prompt preset、推荐动作、模型路由、briefing 形态和模板效果做持续校准，而不是靠人工零散调整。
- 提供“为什么系统会这样建议/这样路由”的反馈可解释摘要，避免黑箱优化。
- 让管理员和产品团队看到哪些规则有效、哪些模板没人用、哪些建议经常被忽略或被回退。

## Capabilities

### New Capabilities
- `learning-loop-from-review-and-usage`: 定义反馈采集、效果归因、策略校准和可解释学习能力。

### Modified Capabilities
- `quality-and-regression`: 需要支持结合真实使用和审阅结果做持续效果回看，而不只看离线基准。
- `quality-gates-for-generation`: 需要将人工通过/退回结果纳入质量门反馈信号。
- `generation-observability-and-guardrails`: 需要暴露可被学习系统消费的行为、成本和失败信号。
- `workspace-api-contract`: 需要提供反馈汇总、策略效果和可解释建议来源接口。

## Impact

- Backend：反馈事件流、效果归因、策略校准存储和可解释摘要生成。
- Frontend：反馈洞察页、效果趋势、策略对比和解释面板。
- Product：这会让 Crystalith 从“有很多规则的系统”慢慢长成“会根据真实结果调整自己的系统”。
- Dependencies：建议接在 `c05-quality-scorecards-and-eval-center`、`c21-proactive-recommendations-and-next-best-actions`、`c29-cost-intelligence-and-model-routing-governance` 之后。
