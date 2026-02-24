# vector-storage (delta) Specification

## ADDED Requirements

### Requirement: Vector store MUST support notebook-scoped entry enumeration
系统 SHALL 在向量存储抽象层提供按 notebook 枚举向量条目的能力，以支持 analysis 等需要全量条目的场景，同时避免跨 notebook 的全量扫描。

最小行为：
- VectorStore `entries` MUST 支持 `notebook_id` 过滤参数
- 当提供 `notebook_id` 时，返回结果 MUST 仅包含该 notebook 的条目
- 当向量后端支持服务端过滤时（例如 Chroma where），实现 MUST 优先使用后端过滤而非应用层过滤

#### Scenario: Enumerate entries for a single notebook
- **WHEN** 调用方请求 `entries(notebook_id=N)`
- **THEN** 返回的所有 `VectorEntry.notebook_id` 均为 `N`

#### Scenario: Backend-supported filtering is used when available
- **WHEN** 向量后端支持 where 子句过滤（例如 Chroma）
- **THEN** 实现使用后端过滤以避免拉取全量 embeddings
