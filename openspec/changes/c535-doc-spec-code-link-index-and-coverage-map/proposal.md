## Why

项目大了以后，一个功能对应哪些 spec、哪些代码路径、哪些文档，经常没人能一下说清。没有一张最基础的链接索引，后面做对齐和清理都会慢。

## What Changes

- 定义 doc/spec/code link index，把规格、设计文档和代码路径建立显式映射。
- 支持 coverage map，展示某个能力现在文档齐不齐、proposal 到哪儿了、代码落在哪些模块。
- 区分人工确认链接和系统推断链接，避免误导。
- 让这张图既服务后续提案推进，也服务重构前摸边界。

## Capabilities

### New Capabilities
- `doc-spec-code-link-index-and-coverage-map`: 定义文档、规格、代码映射和覆盖图语义。

### Modified Capabilities
- `doc-governance`: 需要支持链接索引和覆盖状态。
- `quality-and-regression`: 覆盖图可以成为变更完整度的辅助信号。
- `workspace-api-contract`: 如需前台展示，需要补查询接口。

## Impact

- Backend/Tooling：会影响索引生成、映射存储和覆盖计算。
- Frontend/Docs：会影响覆盖图展示和链接导航。
- Dependencies：这条线偏维护，但会让后续清 proposal 和推进 spec 轻很多。
