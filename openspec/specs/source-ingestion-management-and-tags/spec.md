# source-ingestion-management-and-tags Specification

## Purpose

定义来源管理与标签体系：列表、排序、过滤、chunks、删除、re-embed、tag CRUD 与绑定关系。

## Non-goals

- 不定义上传/URL 抓取流程
- 不定义 QA 与摘要能力

## Requirements

### Requirement: Source list query semantics are stable
来源列表 MUST 支持 tag 精确过滤与稳定排序（date/name/size/type + asc/desc）。

### Requirement: Source list can be epoch-cached
列表结果 SHOULD 基于 `sources_epoch` 缓存并在来源变更后 O(1) 失效。

### Requirement: Chunks endpoint returns deterministic order
来源 chunks 接口 MUST 按 `chunk_index` 升序返回。

### Requirement: Delete and re-embed keep storage and epochs consistent
删除 MUST 同时删 DB 与向量；re-embed MUST 使用既有 chunks 重算向量并维护 epoch。

### Requirement: Tag uniqueness is notebook-scoped and case-insensitive
同一 notebook 下 tag 名称 MUST 大小写不敏感唯一。

### Requirement: Tag mutations invalidate source list caches
tag 创建/更新/删除/绑定/解绑成功后 MUST bump `sources_epoch`。
