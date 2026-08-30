# language: zh-CN
# capability: source-ingestion-summary-and-conversion
# purpose: 定义单来源派生能力与内容转换能力：来源摘要、来源范围 QA、来源问答转来源，以及对话/输出转来源或笔记。该规范强调转换结果可追踪且遵循来源生命周期，避免产生不可检索或不可归因的数据。
# scope: apps/server/src/features/sources/

功能: source-ingestion-summary-and-conversion

  @req:r49 @human
  场景: Source summary is cache-first with explicit regenerate
    - 来源摘要 GET MUST 仅允许 ready 来源且 MUST NOT 调用 LLM：有 metadata.autoSummary 则返回缓存；无缓存时 MUST 返回 200 空态（空 summary/要点/主题，generatedAt 可空）。摘要的生成与覆盖 MUST 仅由 POST 同 path（或 ingest ready 后的异步预生成）完成并写入 metadata.autoSummary。

  @req:r107 @human
  场景: Source-scoped QA is hard-bounded by sourceId
    - 来源 QA MUST 仅在该 `sourceId` 范围内检索与回答。

  @req:r144 @human
  场景: Source QA conversion creates reusable source
    - 来源问答转换 MUST 创建新来源并可立即用于后续检索。

  @req:r179 @human
  场景: Conversation/output conversion keeps traceable metadata
    - 对话或输出转换为来源/笔记时 MUST 记录来源元数据与追踪信息；lineage 语义见 cross-type-result-transformations r86。

  @req:r211 @human
  场景: Conversion follows source lifecycle and epoch rules
    - 任何创建新来源的转换路径 MUST 遵循 source 状态机与 epoch 失效规则。

  @req:summary-qa-error-and-ownership @human
  场景: Summary and per-source QA MUST return 400 for not-ready and verify notebook ownership
    - summary 和 per-source QA 端点在 source 未 ready 时 MUST 返回 400（非 404），且 MUST 校验 source 属于 URL 中的 notebook

  @req:qa-to-source-multi-turn @human
  场景: qa-to-source MUST accept multi-turn messages list
    - qa-to-source 转换 MUST 接受 messages: list[QAMessage] 多轮历史并格式化为完整 transcript 后创建 source（对齐既有语义）；MAY 另接受单轮 {question, answer}。

  @req:tag-binding-must-return-per-item-diagnostics @human
  场景: Tag assign/remove MUST return per-item results with errorCode
    - tag 批量 assign/remove MUST 返回可逐项判定成功/失败的结果；逐项结果形状与缺失/跨 notebook source 的诊断语义 MUST 遵循 source-ingestion-management-and-tags tag-binding-response-and-ownership 与 r268（canonical）。

  @req:convert-embedding-no-ready-on-fail @human
  场景: Source conversion MUST NOT mark ready when embedding fails
    - QA-to-source 和 session convert-to-source 的 embedding 失败处理遵循 source-ingestion-core r2_sync（canonical）：MUST 标记 source 为 failed 而非 ready。

  @req:per-source-qa-vector-search @human
  场景: Per-source QA MUST use vector retrieval
    - per-source QA MUST 通过 embed question + scoped vector search 检索相关 chunk；结果 MUST 按相关度排序返回，MUST NOT 以固定截断数量替代检索排序。

  @req:summary-post-persists-auto-summary @human
  场景: POST summary MUST persist autoSummary
    - POST /v2/notebooks/:nid/sources/:sid/summary MUST 对 ready 来源生成摘要结构，MUST 将结果 merge 写入 sources.metadata.autoSummary，并 MUST 返回与有缓存时 GET 相同形状的 SourceSummary。

  @req:summary-async-after-ready @human
  场景: Ingest MUST async-pregenerate summary after ready
    - 来源 ingest 成功标记 ready 后，系统 SHOULD 异步预生成并写入 metadata.autoSummary；预生成失败 MUST NOT 将 source 标为 failed，也 MUST NOT 阻塞 ingest 成功响应。
