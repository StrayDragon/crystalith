## Why

收件箱能兜住临时内容，但兜住不是终点。真正关键的是，什么时候把散的东西变成 notebook 里的结构化内容。如果没有一条轻量转换路径，收件箱迟早会越积越厚。

## What Changes

- 定义 inbox to notebook conversion，把收件箱项目转成 notebook 结构骨架。
- 支持 structure suggestion，给出可能的标题层级、片段归类和落点建议。
- 区分只是建议结构和已经正式写入，避免一键转换过头。
- 让转换结果能保留与原 inbox 项的回链，方便回看原始上下文。

## Capabilities

### New Capabilities
- `inbox-to-notebook-conversion-and-structure-suggestions`: 定义收件箱转 notebook、结构建议和回链语义。

### Modified Capabilities
- `quick-capture-inbox-and-triage-flow`: 收件箱需要支持结构化转出。
- `notebook-content-model-and-block-editor`: 需要支持从建议骨架落地成 block。
- `workspace-api-contract`: 需要增加转换预览与执行接口。

## Impact

- Backend：会影响转换建议生成、骨架对象和回链存储。
- Frontend：会影响收件箱视图、转换预览和 notebook 创建流程。
- Dependencies：这条线站在 `c145` 和 `c480` 中间，补的是从“临时”到“正式”的过渡。
