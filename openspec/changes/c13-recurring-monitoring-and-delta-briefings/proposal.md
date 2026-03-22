## Why

现在的研究和生成流程已经越来越完整，但它们大多还是“一次跑完”的模式。只要来源会持续变化，用户迟早会问两个问题：哪里变了，以及我能不能不用重来一遍就拿到新的结论。

## What Changes

- 引入 monitor / subscription 概念，让 notebook、source group、knowledge pack 可以被持续观察，而不是只被手动打开。
- 支持按时间、来源变化或同步完成事件触发增量研究，并自动生成 delta briefing。
- 为周期性输出补上暂停、恢复、静默、失败重试和“这次为什么会跑”的解释信息。
- 让用户可以直接订阅“每周摘要”“来源有重大变化时提醒”“重点 pack 自动更新”这类持续工作流。

## Capabilities

### New Capabilities
- `recurring-monitors-and-delta-briefings`: 定义持续监测对象、触发规则、增量简报和订阅交付能力。

### Modified Capabilities
- `background-jobs-and-task-runtime`: 需要支持周期任务、事件触发任务、暂停恢复和运行原因记录。
- `knowledge-curation-and-freshness`: 需要把 freshness、变化检测和再同步结果升级为可触发监测器的正式信号。
- `publishable-artifacts`: 需要支持增量简报、周期版本和“本次更新基于哪些变化”的交付元数据。
- `workspace-ui-panels`: 需要新增监测器、订阅状态、最近触发记录和失败恢复入口。

## Impact

- Backend：任务调度、变化检测、订阅交付、增量输出装配和失败重试策略。
- Frontend：Monitors/Subscriptions 入口、运行历史、触发原因和 delta briefing 查看页。
- Product：这会把 Crystalith 从“能完成一次研究”往“能持续盯住一个主题”再推一步。
- Dependencies：建议接在 `c03-source-readiness-and-freshness-hub`、`c06-publish-and-share-knowledge-packs`、`c10-agentic-research-runs` 之后讨论。
