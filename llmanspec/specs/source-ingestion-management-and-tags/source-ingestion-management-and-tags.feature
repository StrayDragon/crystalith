# language: zh-CN
# capability: source-ingestion-management-and-tags
# purpose: 定义来源管理与标签体系：列表、排序、过滤、chunks、删除、re-embed、tag CRUD 与绑定关系。该规范强调查询语义与失效规则可预测，避免因缓存或排序漂移导致 UI/服务不一致。
# scope: src/, tests/

功能: source-ingestion-management-and-tags

  @req:r48 @human
  场景: Source list query semantics are stable
    - 来源列表 MUST 支持 tag 精确过滤与稳定排序（date/name/size/type + asc/desc）。

  @req:r106 @human
  场景: Source list can be epoch-cached
    - 列表结果 MUST 基于 `sources_epoch` 缓存；失效模型遵循 retrieval-and-cache r174（canonical），来源集合或 tag 相关变更成功后 MUST 使列表缓存失效并在下次查询重建。

  @req:r143 @human
  场景: Chunks endpoint returns deterministic order
    - 来源 chunks 接口 MUST 按 `chunk_index` 升序返回。

  @req:r178 @human
  场景: Delete and re-embed keep storage and epochs consistent
    - 删除 MUST 同时删 DB 与向量；re-embed MUST 使用既有 chunks 重算向量并维护 epoch。

  @req:r256 @human
  场景: Source failures include diagnostic fields
    - 来源在失败或不可恢复状态下 MUST 提供结构化诊断信息，以支持 UI 给出可操作的修复建议。

  @req:r268 @human
  场景: Batch operations return per-item results and keep epoch consistent
    - 批量删除、批量 re-embed 与 tag 绑定/解绑 MUST 返回逐项结果数组（含 errorCode/message）并保持 `sources_epoch` 失效语义可预测；batch delete MUST 使用 DELETE 方法。

  @req:r277 @human
  场景: Optional source dedup does not silently drop data
    - 系统 MAY 支持来源去重，但在命中去重时 MUST 不得静默丢弃用户导入请求。

  @req:sources-reembed-requires-failed @human
  场景: Re-embed MUST require FAILED status
    - POST /sources/:id/re-embed MUST 校验 source 状态为 failed，非 failed MUST 返回 400

  @req:tag-binding-response-and-ownership @human
  场景: Tag binding MUST return stable batch result shape and verify ownership
    - tag binding MUST 返回 {count, results:[SourceBatchItemResult]} 结构，且 DELETE binding MUST 校验 source 属于该 notebook

  @req:tags-uniqueness-and-ownership @human
  场景: Tag operations MUST enforce uniqueness and notebook ownership
    - source tag 的创建和更新 MUST 强制名称唯一性（同一 notebook 下大小写不敏感，冲突返回 409），所有 tag 操作 MUST 校验 tag 属于指定 notebook

  @req:tags-assign-idempotent @human
  场景: Tag assign and remove MUST be idempotent
    - tag 的 assign 和 remove 操作 MUST 验证 source 存在且具备幂等性

  @req:r48 @human
  场景: list-sources-with-filters-and-sort
    - 必须成立：当 用户按 tag 过滤并指定排序参数查询来源列表；那么 系统 SHALL 返回稳定排序结果并按 tag 精确过滤
    当 用户按 tag 过滤并指定排序参数查询来源列表
    那么 系统 SHALL 返回稳定排序结果并按 tag 精确过滤

  @req:r106 @human
  场景: source-list-cache-invalidates-on-epoch-bump
    - 必须成立：当 来源集合或 tag 发生变更并 bump `sources_epoch`；那么 系统 SHALL 使来源列表缓存 O(1) 失效并在下次查询重建
    当 来源集合或 tag 发生变更并 bump `sources_epoch`
    那么 系统 SHALL 使来源列表缓存 O(1) 失效并在下次查询重建

  @req:r143 @human
  场景: chunks-are-ordered-by-chunk-index
    - 必须成立：当 客户端请求某来源的 chunks；那么 系统 SHALL 按 `chunk_index` 升序返回结果
    当 客户端请求某来源的 chunks
    那么 系统 SHALL 按 `chunk_index` 升序返回结果

  @req:r178 @human
  场景: re-embed-recomputes-vectors-without-changing-chunks
    - 必须成立：当 用户对一个来源执行 re-embed；那么 系统 SHALL 使用既有 chunks 重算向量并维护 epoch 一致性
    当 用户对一个来源执行 re-embed
    那么 系统 SHALL 使用既有 chunks 重算向量并维护 epoch 一致性

  @req:tags-uniqueness-and-ownership @human
  场景: tags-are-unique-case-insensitively
    - 必须成立：当 用户在同一 notebook 创建 tag `AI` 与 `ai`；那么 系统 SHALL 将其视为冲突并保持大小写不敏感唯一性
    当 用户在同一 notebook 创建 tag `AI` 与 `ai`
    那么 系统 SHALL 将其视为冲突并保持大小写不敏感唯一性

  @req:r256 @human
  场景: source-ingestion-fails-with-stable-error-code
    - 必须成立：当 某来源导入/解析/索引失败并进入 FAILED 状态；那么 系统 SHALL 返回稳定的 `errorCode`
    当 某来源导入/解析/索引失败并进入 FAILED 状态
    那么 系统 SHALL 返回稳定的 `errorCode`

  @req:r268 @human
  场景: batch-delete-returns-partial-failures
    - 必须成立：当 用户发起批量删除且其中部分来源不可删除或不存在；那么 系统 SHALL 返回逐项成功/失败结果
    当 用户发起批量删除且其中部分来源不可删除或不存在
    那么 系统 SHALL 返回逐项成功/失败结果

  @req:r277 @human
  场景: dedup-hit-requires-explicit-user-choice
    - 必须成立：当 系统检测到新导入来源与既有来源 dedup_key 冲突；那么 系统 SHALL 提供"复用既有来源"或"仍创建新来源"的明确选择（或等价机制）
    当 系统检测到新导入来源与既有来源 dedup_key 冲突
    那么 系统 SHALL 提供"复用既有来源"或"仍创建新来源"的明确选择（或等价机制）

  @req:sources-reembed-requires-failed @human
  场景: reembed-ready-source
    - 必须成立：假如 source 状态为 ready；当 客户端请求 re-embed；那么 系统 SHALL 返回 400 拒绝
    假如 source 状态为 ready
    当 客户端请求 re-embed
    那么 系统 SHALL 返回 400 拒绝

  @req:r268 @human
  场景: batch-delete-method-and-per-item-array
    - 必须成立：假如 客户端请求 batch delete；当 删除完成；那么 系统 SHALL 返回 per-item results 数组且使用 DELETE 方法
    假如 客户端请求 batch delete
    当 删除完成
    那么 系统 SHALL 返回 per-item results 数组且使用 DELETE 方法

  @req:tag-binding-response-and-ownership @human
  场景: delete-binding-cross-notebook
    - 必须成立：假如 source 属于其它 notebook；当 客户端请求 DELETE binding；那么 系统 SHALL 拒绝（404 或 400）
    假如 source 属于其它 notebook
    当 客户端请求 DELETE binding
    那么 系统 SHALL 拒绝（404 或 400）

  @req:tags-uniqueness-and-ownership @human
  场景: duplicate-name
    - 必须成立：假如 notebook 已有名为 Research 的 tag；当 创建同名 tag（不同大小写）；那么 系统 SHALL 返回 409 冲突错误
    假如 notebook 已有名为 Research 的 tag
    当 创建同名 tag（不同大小写）
    那么 系统 SHALL 返回 409 冲突错误

  @req:tags-assign-idempotent @human
  场景: reassign
    - 必须成立：假如 source 已被 assigned 到 tag；当 再次 assign 同一 tag；那么 系统 SHALL 返回幂等提示而非插入重复行
    假如 source 已被 assigned 到 tag
    当 再次 assign 同一 tag
    那么 系统 SHALL 返回幂等提示而非插入重复行
