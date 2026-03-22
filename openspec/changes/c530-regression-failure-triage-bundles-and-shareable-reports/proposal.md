## Why

回归失败最怕一种情况：知道它失败了，但不知道怎么把现场描述给别人。没有一份能打包上下文的 triage bundle，很多失败最后都要靠口头再解释一次。

## What Changes

- 定义 regression triage bundle，把失败场景、关键日志、状态摘要和相关快照打成可分享对象。
- 支持 shareable report，让失败信息可以被稳定引用，而不是散在聊天记录里。
- 区分临时排查包和长期问题报告，避免所有失败都被永久沉淀。
- 让 triage bundle 能挂接到回归 harness、评测片段和契约漂移。

## Capabilities

### New Capabilities
- `regression-failure-triage-bundles-and-shareable-reports`: 定义回归失败分诊包、分享报告和问题上下文语义。

### Modified Capabilities
- `workspace-scenario-fixtures-and-regression-harness`: 失败场景需要能导出 triage bundle。
- `real-workspace-eval-dataset-capture-and-replay`: 真实评测失败需要能转 triage bundle。
- `openapi-client-contract-drift-watch`: 契约漂移失败需要进入统一报告。

## Impact

- Backend：会影响失败打包、报告对象和引用关系。
- Frontend：会影响失败页、导出入口和报告查看器。
- Dependencies：这条线给维护层补的是“失败以后怎么协作排查”。
