# source-ingestion-core Specification

## Purpose

定义 Source 摄取生命周期不变量：状态机、ready 语义、删除语义与 epoch 失效规则。该规范用于保证摄取与检索之间的因果一致性，避免出现“状态 ready 但不可检索”的漂移。

## Non-goals

- 不定义上传/URL 的具体输入校验细节
- 不定义来源标签 API 字段细节

## Requirements

### Requirement: Source status machine is fixed
Source 状态 MUST 仅使用 `processing|ready|failed`，并保持对外稳定。

#### Scenario: Source transitions remain in allowed set
- **WHEN** 系统创建或更新一个来源的摄取状态
- **THEN** 状态 SHALL 仅在 `processing|ready|failed` 集合内变化

### Requirement: Ready source guarantees retrievability
`ready` 来源 MUST 已持久化 chunks 且对应向量可被检索命中。

#### Scenario: Ready implies retrievable
- **WHEN** 来源被标记为 `ready`
- **THEN** 系统 SHALL 保证其 chunks 已持久化且向量可被检索命中

### Requirement: Source and vector mutations bump epochs
影响来源集合或向量集合的操作 MUST bump `sources_epoch` 与/或 `vector_epoch`。

#### Scenario: Mutations invalidate caches
- **WHEN** 发生影响来源集合或向量集合的变更操作
- **THEN** 系统 SHALL bump `sources_epoch` 与/或 `vector_epoch` 以触发缓存失效

### Requirement: Epoch updates are atomic under concurrency
并发情况下 epoch bump MUST 原子且单调递增。

#### Scenario: Concurrent bumps are monotonic
- **WHEN** 多个并发请求同时触发 epoch bump
- **THEN** 系统 SHALL 保证 bump 原子且单调递增

### Requirement: Source deletion removes vector entries
删除来源后 MUST 同步移除向量存储对应记录，防止幽灵检索结果。

#### Scenario: Deleting a source removes vectors
- **WHEN** 用户删除一个来源
- **THEN** 系统 SHALL 移除该来源的向量记录以避免幽灵检索结果
