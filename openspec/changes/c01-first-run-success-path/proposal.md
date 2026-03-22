## Why

现在的能力已经不少，但第一次进入 Workspace 的人还是得自己理解 notebook、source、session 和 studio 之间的关系。第一轮成功路径不够短，会直接影响试用转化和后续留存。

## What Changes

- 增加首次进入引导，把“导入资料 -> 发起会话 -> 生成第一个结果”收成一条默认主线。
- 为空态、半完成态和失败态提供明确的下一步动作，而不是只显示状态本身。
- 引入可恢复的 onboarding 进度，让用户下次回来还能接着走。
- 为试用和演示场景预留 guided demo 或 starter notebook 入口。

## Capabilities

### New Capabilities

- `first-run-activation`: 定义首次成功路径、引导状态和下一步动作契约。

### Modified Capabilities

- `workspace-ui-core`: 增加首次进入、空态和分层引导的稳定要求。
- `workspace-ui-panels`: 各面板需要暴露 onboarding 所需的最小动作与状态。
- `workspace-command-registry`: 需要支持 onboarding 主线动作的可发现入口。

## Impact

- Frontend：Workspace 顶层布局、空态组件、引导状态存储。
- Backend/API：可能需要返回 onboarding progress、workspace readiness 和 demo seed 信息。
- Product：这是整组路线的入口提案，建议优先讨论。
- Dependencies：建议在 `c00-workspace-object-model-and-readiness-contract` 先把对象状态和 readiness 词汇收口后推进，这样首次路径不会自己再造一套状态语义。
