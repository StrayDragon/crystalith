# vector-storage Specification

## Purpose

定义向量存储抽象与后端选择：支持 memory/sqlite/chroma 等 provider，在统一接口下提供 upsert/search/search_many、来源过滤与排除能力，并为不同 provider 明确性能特性与部署形态（embedded vs HTTP）。

## Related specs

- `GLOSSARY.md`
- `config-management/spec.md`
- `vector-search-cache/spec.md`
- `generation-retrieval/spec.md`
- `cross-document-analysis/spec.md`

## Requirements
### Requirement: Chroma Vector Storage (embedded or HTTP)
系统 MUST 支持以 Chroma 作为持久化向量存储后端，并支持两种部署形态：
- **embedded**：当 `vector_storage.chroma.host` 为空时，使用本地持久化目录 `vector_storage.chroma.path`（需要 `chromadb` 依赖）。
- **HTTP**：当 `vector_storage.chroma.host` 非空时，通过 HTTP 连接到外部 Chroma 服务（不要求安装 `chromadb`）。

搜索 MUST 使用 Chroma 原生索引查询，不在应用层做暴力遍历。
最小行为：
- embedded 模式下数据 MUST 可持久化并在重启后可检索；`vector_storage.chroma.path` 不可写时 MUST 启动失败并给出明确错误信息
- `vector_storage.chroma.telemetry` 未设置或为 false 时，Chroma 遥测 MUST 保持关闭
- `search` MUST 使用 Chroma 原生 `collection.query()` 执行 ANN 搜索（不加载全量条目到内存），并通过 where 子句支持 `source_ids` / `exclude_source_ids` 过滤

### Requirement: Vector store MUST support notebook-scoped entry enumeration
系统 SHALL 在向量存储抽象层提供按 notebook 枚举向量条目的能力，以支持 analysis 等需要全量条目的场景，同时避免跨 notebook 的全量扫描。

最小行为：
- VectorStore `entries` MUST 支持 `notebook_id` 过滤参数
- 当提供 `notebook_id` 时，返回结果 MUST 仅包含该 notebook 的条目
- 当向量后端支持服务端过滤时（例如 Chroma where），实现 MUST 优先使用后端过滤而非应用层过滤

### Requirement: Vector Storage Provider Configuration
系统 MUST 支持通过 `vector_storage.provider` 选择向量后端，并支持 `memory`、`sqlite` 与 `chroma`。
`memory` 模式重启后数据会丢失；`sqlite` 模式使用 `vector_storage.sqlite.path` 持久化（搜索语义正确但性能特性与 Chroma 不同，部分实现 MAY 为应用层 brute-force）。

### Requirement: Legacy SQLite 迁移
系统 MUST 提供从旧 SQLite 向量库迁移到 Chroma 的工具或函数。

### Requirement: 向量搜索来源排除
系统 MUST 支持在向量搜索时排除指定来源的条目，用于跨文档分析等场景。

multi-query 的 seeds、融合策略与缓存属于检索策略层，见 `generation-retrieval/spec.md`。

### Requirement: Batch vector search
系统 SHALL 支持批量向量检索接口（`search_many`），以一次调用处理多个 query 向量并返回分组结果，减少高延迟向量后端的调用开销。
`search_many(query_vectors)` 的返回 MUST 为与输入等长的结果列表（`list[list[VectorSearchResult]]`），每个位置仅对应同位置 query 向量；空/维度不匹配的 query 向量 MUST 返回空组。
