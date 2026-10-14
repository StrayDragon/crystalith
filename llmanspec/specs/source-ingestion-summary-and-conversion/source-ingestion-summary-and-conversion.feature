# language: zh-CN
# capability: source-ingestion-summary-and-conversion
# purpose: 定义单来源派生能力与内容转换能力：来源摘要、来源范围 QA、来源问答转来源，以及对话/输出转来源或笔记。该规范强调转换结果可追踪且遵循来源生命周期，避免产生不可检索或不可归因的数据。

功能: source-ingestion-summary-and-conversion

  @req:r273
  规则: Source summary is cache-first with explicit regenerate
    来源摘要 GET MUST 仅允许 ready 来源且 MUST NOT 调用 LLM：有 metadata.autoSummary 则返回缓存；无缓存时 MUST 返回 200 空态（空 summary/要点/主题，generatedAt 可空）。摘要的生成与覆盖 MUST 仅由 POST 同 path（或 ingest ready 后的异步预生成）完成并写入 metadata.autoSummary。

    场景: summary-get-cache-first
      假如 笔记本内有一篇 ready 且尚无 metadata.autoSummary 的来源
      当 发送 GET 请求"/v2/notebooks/{当前笔记本[id]}/sources/{当前来源[id]}/summary"（见 sources/summary-cache.test.ts）
      那么 响应状态码为200 且返回空 summary/要点/主题且全程不调用 LLM
      而且 写入 metadata.autoSummary 后再次 GET 直接命中缓存
  @req:r274
  规则: Source-scoped QA is hard-bounded by sourceId
    来源 QA MUST 仅在该 `sourceId` 范围内检索与回答。

    场景: qa-scoped-to-source-id
      假如 笔记本内有两篇已索引来源且问题在另一篇来源中得分更高
      当 对来源 A 发起 per-source QA（见 sources/c117-per-source-qa.test.ts）
      那么 检索上下文仅含来源 A 的分块而不泄漏其它来源分块
      而且 scoped 检索无命中时回退也只读取来源 A 自身分块
  @req:r275
  规则: Source QA conversion creates reusable source
    来源问答转换 MUST 创建新来源并可立即用于后续检索。

    场景: qa-to-source-creates-reusable-source
      假如 笔记本内有一篇 ready 来源及其问答结果
      当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/sources/{当前来源[id]}/qa-to-source"（见 sources/qa-to-source-and-tags.test.ts）
      那么 转换创建的新来源走完整摄取生命周期
      而且 转换完成后新来源可在后续检索中命中
  @req:r276
  规则: Conversation/output conversion keeps traceable metadata
    对话或输出转换为来源/笔记时 MUST 记录来源元数据与追踪信息；lineage 语义见 cross-type-result-transformations r40。

    场景: conversion-records-lineage-metadata
      假如 笔记本内有一篇 ready 来源及其 QA 结果与一段会话消息
      当 分别执行 qa-to-source 与 session convert-to-source（见 sources/c117-conversion-lineage.test.ts）
      那么 新来源 metadata 记录 qa_from_source 与 original_filename
      而且 会话转换新来源 metadata 记录 convertedFromSession、messageCount 与 conversionTimestamp
  @req:r277
  规则: Conversion follows source lifecycle and epoch rules
    任何创建新来源的转换路径 MUST 遵循 source 状态机与 epoch 失效规则。

    场景: conversion-follows-lifecycle-and-epochs
      假如 已按当前 epoch 写入检索缓存哨兵
      当 执行 qa-to-source 与 session convert-to-source（见 sources/c117-conversion-lineage.test.ts）
      那么 两类转换的新来源在向量写入成功后置 ready
      而且 notebook 的 vector/sources epoch 递增使原缓存失效
  @req:r278
  规则: Summary and per-source QA MUST return 400 for not-ready and verify notebook ownership
    summary 和 per-source QA 端点在 source 未 ready 时 MUST 返回 400（非 404），且 MUST 校验 source 属于 URL 中的 notebook

    场景: summary-qa-not-ready-and-ownership
      假如 笔记本内有一篇 processing 来源与一篇属于其它笔记本的 ready 来源
      当 对二者分别请求 summary 与 per-source QA（见 sources/c117-per-source-qa.test.ts）
      那么 未 ready 的来源返回 400 INVALID_REQUEST 而非 404
      而且 跨 notebook 的来源返回 404 且其自身状态不受影响
  @req:r279
  规则: qa-to-source MUST accept multi-turn messages list
    qa-to-source 转换 MUST 接受 messages: list[QAMessage] 多轮历史并格式化为完整 transcript 后创建 source（对齐既有语义）；MAY 另接受单轮 {question, answer}。

    场景: qa-to-source-multi-turn-messages
      假如 一段包含多轮问答历史的 messages 数组
      当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/sources/{当前来源[id]}/qa-to-source"携带该数组（见 sources/qa-to-source-and-tags.test.ts multi-turn 用例）
      那么 创建的新来源内容为格式化后的完整 transcript
      而且 空请求体被 422 拒绝
  @req:r280
  规则: Tag assign/remove MUST return per-item results with errorCode
    tag 批量 assign/remove MUST 返回可逐项判定成功/失败的结果；逐项结果形状与缺失/跨 notebook source 的诊断语义 MUST 遵循 source-ingestion-management-and-tags tag-binding-response-and-ownership 与 r267（canonical）。

    场景: tag-assign-remove-per-item-errorcode
      假如 一个空白笔记本
      当 发送 tag 批量 assign/remove 请求且混入缺失的 source id（见 sources/qa-to-source-and-tags.test.ts per-item 用例）
      那么 响应可逐项判定成功/失败
      而且 缺失项的 errorCode 为 SOURCE_NOT_FOUND
  @req:r281
  规则: Source conversion MUST NOT mark ready when embedding fails
    QA-to-source 和 session convert-to-source 的 embedding 失败处理遵循 source-ingestion-core r2_sync（canonical）：MUST 标记 source 为 failed 而非 ready。

    场景: conversion-embedding-failure-marks-failed
      假如 embedding provider 抛出异常
      当 执行 qa-to-source 与 session convert-to-source（见 sources/c117-conversion-lineage.test.ts）
      那么 两类转换的新来源均被标记为 failed 而非 ready
      而且 错误信息携带失败原因（HTTP 500 INTERNAL_ERROR）
  @req:r282
  规则: Per-source QA MUST use vector retrieval
    per-source QA MUST 通过 embed question + scoped vector search 检索相关 chunk；结果 MUST 按相关度排序返回，MUST NOT 以固定截断数量替代检索排序。

    场景: qa-vector-relevance-ordering
      假如 来源内强相关分块的 chunkIndex 大于弱相关分块
      当 对该来源发起问答（见 sources/c117-per-source-qa.test.ts 的 r282 用例）
      那么 QA 上下文经 embed question + scoped vector search 检索
      而且 上下文按相关度排序（弱相关分块不因插入顺序靠前而排在强相关之前）
  @req:r283
  规则: POST summary MUST persist autoSummary
    POST /v2/notebooks/:nid/sources/:sid/summary MUST 对 ready 来源生成摘要结构，MUST 将结果 merge 写入 sources.metadata.autoSummary，并 MUST 返回与有缓存时 GET 相同形状的 SourceSummary。

    场景: summary-post-persists-autosummary
      假如 笔记本内有一篇 ready 来源
      当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/sources/{当前来源[id]}/summary"（见 sources/summary-cache.test.ts POST 用例）
      那么 摘要结果被 merge 写入 metadata.autoSummary
      而且 返回的 SourceSummary 与随后 GET 缓存命中时形状一致
  @req:r284
  规则: Ingest MUST async-pregenerate summary after ready
    来源 ingest 成功标记 ready 后，系统 SHOULD 异步预生成并写入 metadata.autoSummary；预生成失败 MUST NOT 将 source 标为 failed，也 MUST NOT 阻塞 ingest 成功响应。

    场景: async-pregenerate-after-ready
      假如 一个来源刚经摄取完成并标记 ready
      当 观察摄取响应与后台预生成（见 sources/c117-summary-pregenerate.test.ts）
      那么 摄取响应不被摘要预生成阻塞且 metadata.autoSummary 最终写入
      而且 预生成失败不将来源标为 failed 也不影响成功响应
