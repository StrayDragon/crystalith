## Why

有了 onboarding 和 recipes 之后，用户至少知道怎么开始。但当工作区逐渐复杂起来，真正卡住人的往往不是“没有按钮”，而是“不知道接下来最值得做哪一步”。产品要再往前，就得学会主动提示，而不是一直等用户自己发现问题。

## What Changes

- 引入 next best action 能力，根据来源状态、结果质量、证据缺口、历史行为和当前上下文主动给出下一步建议。
- 支持推荐补来源、重跑某个 recipe、进入 evidence review、更新过期 pack、切换更合适的输出形式等动作。
- 把建议分成轻提示、重要提醒和可一键执行的动作，而不是只给一排泛泛的 chips。
- 让系统在空态、半完成态、结果生成后和长期监测场景下，都能给出更有针对性的推进建议。

## Capabilities

### New Capabilities
- `proactive-guidance-and-next-actions`: 定义主动建议、上下文动作和系统提醒能力。

### Modified Capabilities
- `workspace-command-registry`: 需要支持系统生成的上下文动作，而不只是静态命令集合。
- `generation-presets-and-constraints`: 需要支持基于任务和来源状态推荐更合适的预设或控制项。
- `knowledge-curation-and-freshness`: 需要向建议系统暴露过期、缺失和同步异常等信号。
- `quality-gates-for-generation`: 需要把质量不足、证据薄弱和结构异常转成可执行建议，而不是只停留在告警。
- `workspace-ui-core`: 需要为主动建议、提醒等级和一键执行入口提供稳定承载。

## Impact

- Backend：建议规则引擎、上下文聚合、动作推荐和反馈闭环。
- Frontend：推荐卡片、提醒栏、空态/结果态下一步动作和一键执行入口。
- Product：这会让 Crystalith 从“响应式工具”慢慢长成“会主动推进工作的系统”。
- Dependencies：建议接在 `c02-recipe-driven-workflows`、`c04-evidence-gap-and-claim-checking`、`c13-recurring-monitoring-and-delta-briefings`、`c16-cross-notebook-insight-graph` 之后讨论。
