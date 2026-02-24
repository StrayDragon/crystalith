# source-ingestion-core Specification

## Purpose

定义 Source 摄取生命周期不变量：状态机、ready 语义、删除语义与 epoch 失效规则。

## Non-goals

- 不定义上传/URL 的具体输入校验细节
- 不定义来源标签 API 字段细节

## Requirements

### Requirement: Source status machine is fixed
Source 状态 MUST 仅使用 `processing|ready|failed`，并保持对外稳定。

### Requirement: Ready source guarantees retrievability
`ready` 来源 MUST 已持久化 chunks 且对应向量可被检索命中。

### Requirement: Source and vector mutations bump epochs
影响来源集合或向量集合的操作 MUST bump `sources_epoch` 与/或 `vector_epoch`。

### Requirement: Epoch updates are atomic under concurrency
并发情况下 epoch bump MUST 原子且单调递增。

### Requirement: Source deletion removes vector entries
删除来源后 MUST 同步移除向量存储对应记录，防止幽灵检索结果。
