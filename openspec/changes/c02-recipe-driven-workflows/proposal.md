## Why

Crystalith 已经能做不少事，但用户仍然要自己决定先导入什么、再问什么、最后生成什么。能力很多不等于任务顺手，缺的恰恰是“直接开干”的默认路径。

## What Changes

- 引入 recipe/workflow 概念，把常见任务打包成可直接启动的工作流。
- 提供一组官方 recipe，比如“资料导入 -> briefing”“多来源对比 -> report”“导入 -> slides + quiz”。
- 支持 recipe 预填输出类型、提示词、参数和推荐步骤。
- 让 recipe 可以从空态、命令面板和 Studio 入口一键启动。

## Capabilities

### New Capabilities

- `workflow-recipes`: 定义工作流模板、默认参数和启动入口。

### Modified Capabilities

- `workspace-ui-core`: 需要新增 recipe 入口与上下文展示。
- `workspace-command-registry`: 需要支持 recipe 级动作和快捷启动。
- `generation-presets-and-constraints`: 需要支持 recipe 预设对生成参数的约束。
- `studio-output-types`: 需要让输出类型选择器能接收 recipe 预配置。

## Impact

- Frontend：模板选择器、recipe 卡片、上下文状态和启动流程。
- Backend：模板描述模型、默认参数装配逻辑、官方 recipe 注册机制。
- Dependencies：建议紧接 `c01-first-run-success-path` 讨论，这样两者能拼成完整激活链路。
