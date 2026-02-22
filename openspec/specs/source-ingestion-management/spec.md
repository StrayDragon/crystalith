# source-ingestion-management Specification

## Purpose

定义 Source 的管理端点契约：来源列表/排序/按 tag 过滤、chunks 列表、删除（单个/批量）与 re-embed（单个/批量），以及与缓存 epoch 的一致性要求。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`
- `source-ingestion/spec.md`
- `source-ingestion-tags/spec.md`
- `vector-search-cache/spec.md`

## Requirements

### Requirement: List sources supports tag and stable sorting
系统 MUST 提供 `GET /v1/notebooks/{notebook_id}/sources`，并支持：

- `tag`：按标签过滤（空白会被归一化；为空视为不筛选）
- `sort_by: date|name|size|type`
- `sort_order: asc|desc`
默认排序 MUST 为创建时间倒序（date desc）。tag 过滤 MUST 使用归一化后的精确匹配（例如 `"  论文  "` → `论文`）。

### Requirement: List sources is cacheable via sources_epoch
系统 SHOULD 缓存 sources 列表响应（包含 tag/sort 维度），并在 sources 变更后通过 bump `sources_epoch` 实现 O(1) 失效。
在相同 tag/sort 且期间无 sources 变更时，重复请求 MAY 命中缓存返回。

### Requirement: List chunks returns chunk_index ascending
系统 MUST 提供 `GET /v1/notebooks/{notebook_id}/sources/{source_id}/chunks`，返回 `ChunkRead[]` 且按 `chunk_index` 升序排列。

### Requirement: Delete removes DB rows and vector entries
系统 MUST 提供删除端点：

- `DELETE /v1/notebooks/{notebook_id}/sources/{source_id}`
- `DELETE /v1/notebooks/{notebook_id}/sources/batch`（body: `source_ids[]`）

并保证删除后向量存储中对应 source 的向量被移除，同时 bump `sources_epoch` 与 `vector_epoch`。

### Requirement: Re-embed uses existing chunks
系统 MUST 提供 re-embed 端点：

- `POST /v1/notebooks/{notebook_id}/sources/{source_id}/re-embed`（仅允许 `failed`）
- `POST /v1/notebooks/{notebook_id}/sources/batch/re-embed`（允许 `ready|failed`，但拒绝 `processing`）

re-embed MUST 使用该 source 既有 chunks 的 `text` 重新计算向量，并更新向量存储；成功后 bump `sources_epoch` 与 `vector_epoch`。
单个 re-embed 成功后 SHOULD 将 status 更新为 `ready`。

source 没有任何 chunks 时 re-embed MUST 返回 400（Source has no chunks to re-embed）。
