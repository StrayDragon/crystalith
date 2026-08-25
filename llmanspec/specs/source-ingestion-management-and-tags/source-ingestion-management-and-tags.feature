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
    - 来源删除必须同步移除 DB 记录与向量存储记录（见 source-ingestion-core r209，canonical）；re-embed MUST 使用既有 chunks 重算向量并维护 epoch 一致性。

  @req:r256 @human
  场景: Source failures include diagnostic fields
    - 来源在失败或不可恢复状态下 MUST 提供结构化诊断信息，以支持 UI 给出可操作的修复建议。

  @req:r268 @human
  场景: Batch operations return per-item results and keep epoch consistent
    - 批量删除、批量 re-embed 与 tag 绑定/解绑 MUST 返回逐项结果数组（含 errorCode/message），部分来源不可删除或不存在时仍逐项报告成功/失败，并保持 `sources_epoch` 失效语义可预测。本条为批操作逐项结果形状的 canonical 约束。

  @req:r277 @human
  场景: Optional source dedup does not silently drop data
    - 系统 MAY 支持来源去重，但命中去重时 MUST 不得静默丢弃用户导入请求，MUST 提供「复用既有来源」或「仍创建新来源」的明确选择（或等价机制）。

  @req:sources-reembed-requires-failed @human
  场景: Re-embed MUST require FAILED status
    - POST /sources/:id/re-embed MUST 校验 source 状态为 failed，非 failed MUST 返回 400

  @req:sources-reembed-requires-failed @executable
  场景: reembed-ready-source
    假如 一个空白笔记本
    而且 笔记本中有一篇来源"notes.md"
    当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/sources/{当前来源[id]}/re-embed"，内容为：
      """json
      {}
      """
    那么 响应状态码为400

  @req:tag-binding-response-and-ownership @human
  场景: Tag binding MUST return stable batch result shape and verify ownership
    - tag binding MUST 返回 {count, results:[SourceBatchItemResult]} 结构，且 DELETE binding MUST 校验 source 属于该 notebook，跨 notebook 时 SHALL 拒绝（404 或 400）。本条为 tag 绑定响应与归属校验的 canonical 约束。

  @req:tags-uniqueness-and-ownership @human
  场景: Tag operations MUST enforce uniqueness and notebook ownership
    - source tag 的创建和更新 MUST 强制名称唯一性（同一 notebook 下大小写不敏感，冲突返回 409），所有 tag 操作 MUST 校验 tag 属于指定 notebook

  @req:tags-uniqueness-and-ownership @executable
  场景: duplicate-name
    假如 一个空白笔记本
    而且 已存在来源标签"Research"
    当 创建一个名为"research"的来源标签
    那么 响应状态码为409

  @req:tags-assign-idempotent @human
  场景: Tag assign and remove MUST be idempotent
    - tag 的 assign 和 remove 操作 MUST 验证 source 存在且具备幂等性

  @req:tags-assign-idempotent @executable
  场景: reassign
    假如 一个空白笔记本
    而且 笔记本中有一篇来源"notes.md"
    而且 已存在来源标签"core"
    当 将该标签分配给当前来源
    而且 将该标签分配给当前来源
    那么 响应状态码为200
