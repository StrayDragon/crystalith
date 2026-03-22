## Why

现在的工作流已经能生成结果、审阅结果、发布结果，但还不太能回答另一个管理层很常问的问题：这些工作最后到底服务了什么目标，产生了什么影响。没有目标和结果之间的挂钩，产品就很难从“做了很多事”走到“这件事值不值得继续做”。

## What Changes

- 引入 outcome goal 和 impact tracking，让 notebook、research run、artifact 和 briefing 可以挂到更高层的业务目标上。
- 支持记录目标状态、关键证据、相关产物、负责人和阶段性结论，而不是只记录生成历史。
- 允许用户查看某个目标下有哪些来源、哪些产物、哪些审阅结论、哪些行动已经推进。
- 让系统能够把“下一步建议”从任务层扩展到目标层，提醒哪些目标缺资料、缺审批、缺交付。

## Capabilities

### New Capabilities
- `outcome-goals-and-impact-tracking`: 定义目标对象、结果归属、状态推进和影响追踪能力。

### Modified Capabilities
- `background-jobs-and-task-runtime`: 需要支持任务和 run 关联到长期目标，而不只是一次性执行单元。
- `publishable-artifacts`: 需要支持产物与目标对象的稳定关联和状态摘要回写。
- `workspace-ui-core`: 需要提供目标视图、进展摘要和目标级下一步动作入口。
- `workspace-api-contract`: 需要增加目标对象、状态更新、目标关联查询和影响摘要接口。

## Impact

- Backend：目标模型、关联索引、影响摘要聚合和状态更新逻辑。
- Frontend：目标面板、目标详情、进度视图和目标级提醒。
- Product：这会让 Crystalith 更像一个能围绕成果推进工作的系统，而不是只积累内容。
- Dependencies：建议接在 `c10-agentic-research-runs`、`c13-recurring-monitoring-and-delta-briefings`、`c21-proactive-recommendations-and-next-best-actions` 之后。
