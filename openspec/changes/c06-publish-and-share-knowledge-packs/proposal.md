## Why

结果能生成，不代表结果能交付。现在的输出更像一次性的工作产物，缺少一个稳定包装层，把 briefing、slides、guide、quiz 和证据关系整理成真正可以流转的交付件。

## What Changes

- 引入 knowledge pack 概念，把多种输出和其来源、审阅状态、版本信息打包成一个可管理对象。
- 支持从已审阅结果生成 knowledge pack，而不是每次都从零导出。
- 为 pack 提供版本、摘要、封面信息和导出元数据，方便后续分享和复用。
- 让 pack 成为外部分享、发布和后续协作的统一承载体。

## Capabilities

### New Capabilities

- `knowledge-packs`: 定义多输出打包、版本和交付元数据。

### Modified Capabilities

- `publishable-artifacts`: 需要从单个产物扩展到可组合的交付包。
- `studio-output-types`: 各类输出需要声明进入 knowledge pack 的最小契约。
- `evidence-review-workflow`: 已审阅状态需要能稳定挂接到 pack 级对象上。
- `cross-type-result-transformations`: 不同输出之间的转换关系需要能服务打包流程。

## Impact

- Backend：pack 模型、版本存储、导出装配和引用关系整理。
- Frontend：发布向导、pack 详情页、导出与复用入口。
- Dependencies：这是“可信结果”进入“可交付资产”的分水岭，建议在质量与审阅能力之后推进。
