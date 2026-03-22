## Why

结构化生成一旦失败，真正需要的不是一句“再试一次”，而是知道这次失败属于哪一类，下一次该怎么试。没有错误分类和重试桶，重试会一直显得很盲。

## What Changes

- 定义 structured generation retry bucket，把常见失败按 schema、解析、模型、上下文和后处理分类。
- 为不同 bucket 配置不同重试策略，而不是统一重跑。
- 支持把错误分类回流到模型选择、预检提示和回归信号。
- 让错误分类成为正式对象，而不是只留在日志文案里。

## Capabilities

### New Capabilities
- `structured-generation-retry-buckets-and-error-taxonomy`: 定义结构化生成错误分类、重试桶和策略语义。

### Modified Capabilities
- `generation-core`: 需要支持错误分类与桶级重试。
- `preflight-output-schema-compatibility-checks`: 预检需要消费历史错误分类。
- `quality-and-regression`: 需要把结构化错误分类纳入回归信号。

## Impact

- Backend：会影响错误分类、重试策略和诊断接口。
- Frontend：会影响错误提示、重试建议和诊断说明。
- Dependencies：这条线是 `c390` 的更底层一层，补的是修之前先分清错误。
