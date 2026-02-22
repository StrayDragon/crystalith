# source-ingestion-tags Specification

## Purpose

定义 Source 标签体系的后端契约：tag 的 CRUD、tag 与 sources 的绑定/解绑，以及与 sources 列表过滤和缓存失效的关系。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`
- `source-ingestion/spec.md`
- `source-ingestion-management/spec.md`

## Requirements

### Requirement: List tags is notebook-scoped
系统 MUST 提供 `GET /v1/notebooks/{notebook_id}/sources/tags`，返回该 notebook 下的 tag 列表。
tags 列表 MUST 按 name（忽略大小写）升序排列。

### Requirement: Create tag enforces uniqueness (case-insensitive)
系统 MUST 提供 `POST /v1/notebooks/{notebook_id}/sources/tags` 创建 tag，并保证同一 notebook 下 tag 名称大小写不敏感唯一。
创建 tag 名称与已有 tag 仅大小写不同 MUST 返回 409（Tag already exists）。

### Requirement: Update and delete tags invalidate sources caches
系统 MUST 支持：

- `PATCH /v1/notebooks/{notebook_id}/sources/tags/{tag_id}`
- `DELETE /v1/notebooks/{notebook_id}/sources/tags/{tag_id}`

并在成功后 bump `sources_epoch` 以失效 sources 列表缓存。

### Requirement: Bind/unbind tags to sources
系统 MUST 支持批量绑定/解绑：

- `POST /v1/notebooks/{notebook_id}/sources/tags/{tag_id}/sources`
- `DELETE /v1/notebooks/{notebook_id}/sources/tags/{tag_id}/sources`

body 均为 `source_ids[]`；系统 SHOULD 去重输入，并忽略已存在/不存在的映射。
对同一 source 多次绑定同一 tag 时映射表 MUST 仅保留一条关系；解绑请求包含未绑定 source_id 时响应 `count` MAY 小于 `len(source_ids)`。
