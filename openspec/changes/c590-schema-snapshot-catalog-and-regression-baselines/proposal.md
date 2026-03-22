## Why

接口、输出 schema 和内部对象结构一旦开始演化，没有一组稳定快照，大家很快就会只知道“哪里又变了”，却说不清“到底是从哪一版开始变的”。快照目录是回归基线的骨架。

## What Changes

- 定义 schema snapshot catalog，保存关键接口和输出结构的快照基线。
- 支持 regression baseline，让不同版本的 schema 可以被明确比较。
- 区分面向 API 的快照、面向输出的快照和内部对象快照，避免混在一起。
- 让快照结果可以被契约漂移、迁移就绪报告和回归 harness 共同消费。

## Capabilities

### New Capabilities
- `schema-snapshot-catalog-and-regression-baselines`: 定义 schema 快照目录、回归基线和差异边界。

### Modified Capabilities
- `openapi-client-contract-drift-watch`: 需要消费快照基线。
- `quality-and-regression`: 需要将快照比较纳入回归。
- `output-rendering-and-typing`: 输出结构快照需要有正式入口。

## Impact

- Backend：会影响快照生成、差异计算和基线管理。
- Frontend：主要影响诊断与维护视图。
- Dependencies：这条线和 `c570`、`c595` 是一组，补的是“变了以后怎么有据可依”。
