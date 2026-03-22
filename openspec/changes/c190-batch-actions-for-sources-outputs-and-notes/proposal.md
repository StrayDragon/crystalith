## Why

当对象一多，单个点开再处理就会变得很慢。真正高频的动作往往是批量标记、批量归档、批量重试、批量导出。现在如果没有正式的批处理语义，用户只能重复做机械操作。

## What Changes

- 定义 batch actions，覆盖 sources、outputs、notes 和待整理对象的高频批量动作。
- 支持批量标签、批量归档、批量重试、批量导出和批量状态变更。
- 区分安全批处理和高风险批处理，必要时提供预览与确认。
- 让批处理直接消费多选状态和命令动作，而不是单独做一套菜单。

## Capabilities

### New Capabilities
- `batch-actions-for-sources-outputs-and-notes`: 定义工作区批处理动作、预览和确认边界。

### Modified Capabilities
- `keyboard-first-panel-navigation-and-multi-select`: 多选需要能被批处理消费。
- `command-intent-routing-and-action-composition`: 命令层需要支持批量动作。
- `workspace-api-contract`: 需要增加批量操作接口与结果摘要。

## Impact

- Backend：会影响批量接口、任务扇出和结果回写。
- Frontend：会影响多选栏、批处理预览和结果反馈。
- Dependencies：这条线站在 `c170` 之后，是把多选变成实用能力的一步。
