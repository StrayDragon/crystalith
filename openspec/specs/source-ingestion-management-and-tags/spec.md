# source-ingestion-management-and-tags Specification

## Purpose

定义来源管理与标签体系：列表、排序、过滤、chunks、删除、re-embed、tag CRUD 与绑定关系。该规范强调查询语义与失效规则可预测，避免因缓存或排序漂移导致 UI/服务不一致。

## Non-goals

- 不定义上传/URL 抓取流程
- 不定义 QA 与摘要能力

## Requirements

### Requirement: Source list query semantics are stable
来源列表 MUST 支持 tag 精确过滤与稳定排序（date/name/size/type + asc/desc）。

#### Scenario: List sources with filters and sort
- **WHEN** 用户按 tag 过滤并指定排序参数查询来源列表
- **THEN** 系统 SHALL 返回稳定排序结果并按 tag 精确过滤

### Requirement: Source list can be epoch-cached
列表结果 MUST 基于 `sources_epoch` 缓存并在来源变更后 O(1) 失效。

#### Scenario: Source list cache invalidates on epoch bump
- **WHEN** 来源集合发生变更并 bump `sources_epoch`
- **THEN** 系统 SHALL 使来源列表缓存 O(1) 失效并在下次查询重建

### Requirement: Chunks endpoint returns deterministic order
来源 chunks 接口 MUST 按 `chunk_index` 升序返回。

#### Scenario: Chunks are ordered by chunk_index
- **WHEN** 客户端请求某来源的 chunks
- **THEN** 系统 SHALL 按 `chunk_index` 升序返回结果

### Requirement: Delete and re-embed keep storage and epochs consistent
删除 MUST 同时删 DB 与向量；re-embed MUST 使用既有 chunks 重算向量并维护 epoch。

#### Scenario: Re-embed recomputes vectors without changing chunks
- **WHEN** 用户对一个来源执行 re-embed
- **THEN** 系统 SHALL 使用既有 chunks 重算向量并维护 epoch 一致性

### Requirement: Tag uniqueness is notebook-scoped and case-insensitive
同一 notebook 下 tag 名称 MUST 大小写不敏感唯一。

#### Scenario: Tags are unique case-insensitively
- **WHEN** 用户在同一 notebook 创建 tag `AI` 与 `ai`
- **THEN** 系统 SHALL 将其视为冲突并保持大小写不敏感唯一性

### Requirement: Tag mutations invalidate source list caches
tag 创建/更新/删除/绑定/解绑成功后 MUST bump `sources_epoch`。

#### Scenario: Tag changes invalidate list cache
- **WHEN** 用户成功创建/更新/删除/绑定/解绑某个 tag
- **THEN** 系统 SHALL bump `sources_epoch` 以使来源列表缓存失效

### Requirement: Source failures include diagnostic fields
来源在失败或不可恢复状态下 MUST 提供结构化诊断信息，以支持 UI 给出可操作的修复建议。

#### Scenario: Source ingestion fails with stable error_code
- **WHEN** 某来源导入/解析/索引失败并进入 FAILED 状态
- **THEN** 系统 SHALL 返回稳定的 `error_code`
- **AND** 可选返回 `error_message` 与 `recovery_hint`
- **AND** 字段语义 SHALL 可被 UI 直接展示而无需解析异常栈

### Requirement: Batch operations return per-item results and keep epoch consistent
批量删除、批量 re-embed 与 tag 绑定/解绑 MUST 返回逐项结果并保持 `sources_epoch` 失效语义可预测。

#### Scenario: Batch delete returns partial failures
- **WHEN** 用户发起批量删除且其中部分来源不可删除或不存在
- **THEN** 系统 SHALL 返回逐项成功/失败结果
- **AND** 成功项对应的存储与 epoch 失效 SHALL 发生
- **AND** 失败项 MUST 返回稳定错误码以便 UI 呈现

### Requirement: Optional source dedup does not silently drop data
系统 MAY 支持来源去重，但在命中去重时 MUST 不得静默丢弃用户导入请求。

#### Scenario: Dedup hit requires explicit user choice
- **WHEN** 系统检测到新导入来源与既有来源 dedup_key 冲突
- **THEN** 系统 SHALL 提供“复用既有来源”或“仍创建新来源”的明确选择（或等价机制）
