## Why

有些上下文不是正式对象，但用户又会频繁来回看，比如临时要点、待验证想法、正在比较的一组结果。没有轻量的固定上下文和草稿区，这些东西只能四处散落。

## What Changes

- 定义 pinned work context，支持把当前对象组合临时钉在一个工作面上。
- 增加 scratchpad，让用户能放短笔记、待核查点和临时摘录，而不必立刻写进正式 notebook。
- 支持从 scratchpad 回写到 notebook、briefing 或来源批注。
- 让 pinned context 和 return point 共享恢复入口，不重复造一套状态。

## Capabilities

### New Capabilities
- `pinned-work-contexts-and-scratchpads`: 定义固定工作上下文、临时草稿区和回写边界。

### Modified Capabilities
- `session-handoff-and-return-points`: 返回点需要支持固定上下文恢复。
- `workspace-shared-ui-state`: 需要表达临时上下文和 scratchpad 状态。
- `workspace-ui-core`: 需要承载 scratchpad 与 pinned area。

## Impact

- Frontend：会影响工作台壳层、临时区交互和回写入口。
- Backend/API：若需要持久化，会影响轻量草稿存储和同步。
- Dependencies：这条线承接 `c160`，处理的是“临时但重要”的那部分上下文。
