# language: zh-CN
# capability: source-ingestion-management-and-tags
# purpose: 定义来源管理与标签体系：列表、排序、过滤、chunks、删除、re-embed、tag CRUD 与绑定关系。该规范强调查询语义与失效规则可预测，避免因缓存或排序漂移导致 UI/服务不一致。
# scope: apps/server/src/features/sources/

功能: source-ingestion-management-and-tags

  @req:r262
  规则: Source list query semantics are stable
    来源列表 MUST 支持 tag 精确过滤与稳定排序（date/name/size/type + asc/desc）。

    场景: list-tag-filter-and-stable-sort
      假如 笔记本内有文件名/类型/chunk 数/更新时间各异的来源且部分绑定标签
      当 以 tag 过滤并以 sortBy=date/name/size/type 加 asc/desc 查询列表（见 sources/c117-mgmt-tags.test.ts）
      那么 tag 过滤为精确匹配且仅返回绑定该标签的来源
      而且 各排序键按请求方向返回稳定顺序且重复查询结果一致
  @req:r263
  规则: Source list can be epoch-cached
    列表结果 MUST 基于 `sources_epoch` 缓存；失效模型遵循 retrieval-and-cache r227（canonical），来源集合或 tag 相关变更成功后 MUST 使列表缓存失效并在下次查询重建。

    场景: list-cache-follows-epoch
      假如 已按 sources_epoch 缓存的来源列表结果
      当 来源集合或 tag 相关变更成功（见 rag/cache.test.ts bump 失效用例）
      那么 sources_epoch 递增使列表缓存失效
      而且 下次列表查询基于新数据重建
  @req:r264
  规则: Chunks endpoint returns deterministic order
    来源 chunks 接口 MUST 按 `chunk_index` 升序返回。

    场景: chunks-ascending-deterministic
      假如 一篇来源的 chunks 以乱序 chunk_index 插入
      当 请求 GET /v2/notebooks/:nid/sources/:sid/chunks（见 sources/c117-mgmt-tags.test.ts）
      那么 返回的 chunkIndex 为升序（0,1,2）
      而且 重复请求返回相同顺序
  @req:r265
  规则: Delete and re-embed keep storage and epochs consistent
    来源删除必须同步移除 DB 记录与向量存储记录（见 source-ingestion-core r256，canonical）；re-embed MUST 使用既有 chunks 重算向量并维护 epoch 一致性。

    场景: delete-and-reembed-consistency
      假如 一篇已索引来源与一篇 failed 且已有 chunks 无向量的来源
      当 删除前者并对后者执行 POST re-embed（见 sources/c117-mgmt-tags.test.ts）
      那么 删除同步清除 DB 行与 vec_chunks 向量行且 sources_epoch 递增使检索缓存失效
      而且 re-embed 复用既有 chunks 重算向量（不新增 chunk 行）、来源置 ready 并失效缓存
  @req:r266
  规则: Source failures include diagnostic fields
    来源在失败或不可恢复状态下 MUST 提供结构化诊断信息，以支持 UI 给出可操作的修复建议。

    场景: failure-includes-diagnostics
      假如 一个会在解析或嵌入阶段失败的来源
      当 摄取该来源直至失败（见 sources/c57-safety-diagnostics.test.ts）
      那么 失败来源携带结构化诊断信息
      而且 四阶段错误码（含 PARSE_ERROR、EMBEDDING_FAILED）均有恢复提示
  @req:r267
  规则: Batch operations return per-item results and keep epoch consistent
    批量删除、批量 re-embed 与 tag 绑定/解绑 MUST 返回逐项结果数组（含 errorCode/message），部分来源不可删除或不存在时仍逐项报告成功/失败，并保持 `sources_epoch` 失效语义可预测。本条为批操作逐项结果形状的 canonical 约束。

    场景: batch-per-item-results
      假如 笔记本内有两篇来源且批量请求中混入一个不存在的来源 id
      当 发送批量删除或批量 re-embed 请求
      那么 响应返回逐项结果数组且每项含 errorCode 与 message
      而且 不存在的 id 逐项报告失败且不影响其余项成功
  @req:r268
  规则: Optional source dedup does not silently drop data
    系统 MAY 支持来源去重，但命中去重时 MUST 不得静默丢弃用户导入请求，MUST 提供「复用既有来源」或「仍创建新来源」的明确选择（或等价机制）。

    场景: dedup-explicit-choice
      假如 笔记本内已有一篇相同内容的来源
      当 不带 dedupAction 重复上传同一内容（见 sources/ingest.test.ts 三分支用例）
      那么 返回 409 SOURCE_DEDUP_HIT 而不静默丢弃导入请求
      而且 dedupAction=reuse 复用既有来源、dedupAction=create_new 创建新来源
  @req:r269
  规则: Re-embed MUST require FAILED status
    POST /sources/:id/re-embed MUST 校验 source 状态为 failed，非 failed MUST 返回 400

    场景: reembed-ready-source
      假如 一个空白笔记本
      而且 笔记本中有一篇来源"notes.md"
      当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/sources/{当前来源[id]}/re-embed"，内容为：
      那么 响应状态码为400
  @req:r270
  规则: Tag binding MUST return stable batch result shape and verify ownership
    tag binding MUST 返回 {count, results:[SourceBatchItemResult]} 结构，且 DELETE binding MUST 校验 source 属于该 notebook，跨 notebook 时 MUST 返回 404（归属 SSOT 见 workspace-api-contract nested-path-nid-is-ownership-ssot）。本条为 tag 绑定响应与归属校验的 canonical 约束。

    场景: tag-binding-batch-shape-and-ownership
      假如 一个空白笔记本
      当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/sources/tags/{当前标签[id]}/sources"批量绑定且混入缺失的 source id（见 sources/qa-to-source-and-tags.test.ts）
      那么 响应返回 {count, results:[SourceBatchItemResult]} 结构且逐项含 errorCode
      而且 对跨 notebook 的 source 执行 DELETE binding 时返回 404
  @req:r271
  规则: Tag operations MUST enforce uniqueness and notebook ownership
    source tag 的创建和更新 MUST 强制名称唯一性（同一 notebook 下大小写不敏感，冲突返回 409），所有 tag 操作 MUST 校验 tag 属于指定 notebook

    场景: duplicate-name
      假如 一个空白笔记本
      而且 已存在来源标签"Research"
      当 创建一个名为"research"的来源标签
      那么 响应状态码为409
  @req:r272
  规则: Tag assign and remove MUST be idempotent
    tag 的 assign 和 remove 操作 MUST 验证 source 存在且具备幂等性

    场景: reassign
      假如 一个空白笔记本
      而且 笔记本中有一篇来源"notes.md"
      而且 已存在来源标签"core"
      当 将该标签分配给当前来源
      而且 将该标签分配给当前来源
      那么 响应状态码为200
