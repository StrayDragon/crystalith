# source-ingestion Specification

## Purpose

定义 Source 的摄取与生命周期：从上传/URL/转换等入口创建 Source，解析为 chunks 并写入向量存储；并暴露稳定的管理端点（list/chunks/delete/re-embed/tags），以统一的 `processing|ready|failed` 状态机驱动 UI 与后续检索/生成链路。

本 spec 是**入口/导航/不变量**文档：不重复 parser、网页提取器、tag API 等细节；具体契约拆分在 focused specs 中。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`（sources 端点 envelope）
- `workspace-sources-ui/spec.md`（Sources 面板交互）
- `source-ingestion-upload/spec.md`
- `source-ingestion-url/spec.md`
- `source-ingestion-management/spec.md`
- `source-ingestion-tags/spec.md`
- `source-ingestion-summary-qa/spec.md`
- `vector-storage/spec.md`（向量写入/删除语义）
- `vector-search-cache/spec.md`（vector_epoch）
- `backend-performance/spec.md`（cache/embedding cache/guardrails）

## Requirements

### Requirement: Source status machine is stable
系统 MUST 仅使用以下 SourceStatus 值，并对外保持稳定：

- `processing`
- `ready`
- `failed`
状态语义：
- ingest 成功（解析 + 嵌入 + 向量写入完成）时 status MUST 变为 `ready` 且 `error_message` 为 null
- ingest 任一步失败时 status MUST 变为 `failed` 且 `error_message` 包含可诊断信息（长度可能被截断）

### Requirement: ready sources are retrievable
系统 MUST 保证 `ready` 的 source 至少满足：

- chunks 已持久化（可通过 `/chunks` 列出）
- 对应向量已写入向量存储（可被检索链路命中）

### Requirement: Vector mutations bump epochs
系统 MUST 在任何“改变 notebook sources 集合或其向量集合”的操作后，失效相关缓存：

- sources 列表/ chunks 列表依赖 `sources_epoch`
- vector search 结果依赖 `vector_epoch`
最小行为：
- 创建 source（上传/URL/转换）成功写入向量后 MUST bump `sources_epoch` 与 `vector_epoch`
- 删除 source（单个或批量）后 MUST bump `sources_epoch` 与 `vector_epoch`
- 仅变更 tag（创建/重命名/绑定/解绑）时 MUST bump `sources_epoch` 且 MUST NOT bump `vector_epoch`

### Requirement: Epoch bumps are atomic and monotonic under concurrency
系统 MUST 保证 `sources_epoch` 与 `vector_epoch` 的 bump 在并发下为原子操作，并保持单调递增（不丢失递增）。

### Requirement: Deletion removes vectors
系统 MUST 在删除 source 后移除其在向量存储中的数据，避免“幽灵 chunks”被检索命中。
