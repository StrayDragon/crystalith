## Why

并不是所有内容都值得做成整本 notebook 或整份 briefing。很多时候，用户只是积累了一段好结构、一个常用小结、一个能反复复用的片段。没有片段级复用，重复整理会越来越多。

## What Changes

- 定义 notebook fragment，把可复用的块组合提炼成独立片段对象。
- 支持 reusable snippet，在不同 notebook 或 briefing 组装里重复使用片段。
- 区分原地引用和复制副本，避免复用后修改影响不清。
- 让片段可以带最小来源与上下文说明，不只是孤立文本块。

## Capabilities

### New Capabilities
- `notebook-fragments-and-reusable-snippets`: 定义可复用片段、引用方式和上下文边界。

### Modified Capabilities
- `notebook-content-model-and-block-editor`: 需要支持片段提炼与插入。
- `briefing-assembly-board-and-evidence-pinning`: 组装板需要能消费片段。
- `workspace-api-contract`: 需要增加片段查询、插入和引用接口。

## Impact

- Backend：会影响片段存储、引用关系和查询。
- Frontend：会影响编辑器、片段库和插入交互。
- Dependencies：这条线站在 `c460` 和 `c475` 中间，补的是“中等粒度复用”。
