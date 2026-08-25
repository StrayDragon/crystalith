# language: zh-CN
# capability: source-ingestion-summary-and-conversion
# purpose: 定义单来源派生能力与内容转换能力：来源摘要、来源范围 QA、来源问答转来源，以及对话/输出转来源或笔记。该规范强调转换结果可追踪且遵循来源生命周期，避免产生不可检索或不可归因的数据。
# scope: src/, tests/

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
    - 对话或输出转换为来源/笔记时 MUST 记录来源元数据与追踪信息。

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
    - tag 批量 assign/remove MUST 返回 per-item 结果 {sourceId, ok, message, errorCode}；缺失/跨 notebook source SHALL 报 SOURCE_NOT_FOUND。

  @req:csv-parser-must-escape-cells @human
  场景: CSV parser MUST escape pipes and newlines in markdown-table cells
    - CSV parser MUST 转义 markdown-table 单元格中的 |（转义为 \|）、换行，截断用 … 省略号（对齐既有语义）。

  @req:convert-embedding-no-ready-on-fail @human
  场景: Source conversion MUST NOT mark ready when embedding fails
    - QA-to-source 和 session convert-to-source 的 embedding 失败处理遵循 source-ingestion-core r2_sync（canonical）：MUST 标记 source 为 failed 而非 ready。

  @req:per-source-qa-vector-search @human
  场景: Per-source QA MUST use vector retrieval
    - per-source QA MUST 通过 embed question + scoped vector search 检索相关 chunk，而非简单取前 N 个 chunk

  @req:summary-post-persists-auto-summary @human
  场景: POST summary MUST persist autoSummary
    - POST /v2/notebooks/:nid/sources/:sid/summary MUST 对 ready 来源生成摘要结构，MUST 将结果 merge 写入 sources.metadata.autoSummary，并 MUST 返回与有缓存时 GET 相同形状的 SourceSummary。

  @req:summary-async-after-ready @human
  场景: Ingest MUST async-pregenerate summary after ready
    - 来源 ingest 成功标记 ready 后，系统 SHOULD 异步预生成并写入 metadata.autoSummary；预生成失败 MUST NOT 将 source 标为 failed，也 MUST NOT 阻塞 ingest 成功响应。

  @req:r49 @human
  场景: get-returns-cache-without-llm
    - 必须成立：假如 ready 来源已有 metadata.autoSummary；当 客户端 GET summary；那么 系统 SHALL 返回缓存内容且不调用聊天模型
    假如 ready 来源已有 metadata.autoSummary
    当 客户端 GET summary
    那么 系统 SHALL 返回缓存内容且不调用聊天模型

  @req:r49 @human
  场景: get-empty-when-missing
    - 必须成立：假如 ready 来源尚无 autoSummary；当 客户端 GET summary；那么 系统 SHALL 返回 200 空态且不调用聊天模型
    假如 ready 来源尚无 autoSummary
    当 客户端 GET summary
    那么 系统 SHALL 返回 200 空态且不调用聊天模型

  @req:r107 @human
  场景: qa-does-not-cross-source-boundary
    - 必须成立：当 用户对某个 `sourceId` 发起来源范围 QA；那么 系统 SHALL 仅在该来源范围内检索与回答
    当 用户对某个 `sourceId` 发起来源范围 QA
    那么 系统 SHALL 仅在该来源范围内检索与回答

  @req:r144 @human
  场景: converted-qa-becomes-a-new-source
    - 必须成立：当 用户将来源问答结果转换为来源；那么 系统 SHALL 创建新来源并使其可用于后续检索
    当 用户将来源问答结果转换为来源
    那么 系统 SHALL 创建新来源并使其可用于后续检索

  @req:r179 @human
  场景: conversion-stores-provenance
    - 必须成立：当 用户将对话或输出转换为来源/笔记；那么 系统 SHALL 记录可追踪的元数据以支持溯源与审计
    当 用户将对话或输出转换为来源/笔记
    那么 系统 SHALL 记录可追踪的元数据以支持溯源与审计

  @req:r211 @human
  场景: conversions-bump-epochs-and-respect-lifecycle
    - 必须成立：当 转换路径创建了新的来源并写入向量或来源集合；那么 系统 SHALL 遵循状态机并按规则 bump 相关 epoch
    当 转换路径创建了新的来源并写入向量或来源集合
    那么 系统 SHALL 遵循状态机并按规则 bump 相关 epoch

  @req:summary-qa-error-and-ownership @human
  场景: source-not-ready
    - 必须成立：假如 source 状态非 ready；当 客户端请求 summary 或 QA；那么 系统 SHALL 返回 400 而非 404
    假如 source 状态非 ready
    当 客户端请求 summary 或 QA
    那么 系统 SHALL 返回 400 而非 404

  @req:qa-to-source-multi-turn @human
  场景: multi-turn-convert
    - 必须成立：假如 客户端发送多轮 messages 历史；当 系统执行 qa-to-source；那么 SHALL 格式化完整 transcript 并转换（与既有语义一致）
    假如 客户端发送多轮 messages 历史
    当 系统执行 qa-to-source
    那么 SHALL 格式化完整 transcript 并转换（与既有语义一致）

  @req:tag-binding-must-return-per-item-diagnostics @human
  场景: tag-binding-missing-source
    - 必须成立：假如 批量 assign 中某 sourceId 不存在；当 系统返回结果；那么 SHALL 在 results 里报 {sourceId, ok:false, errorCode:SOURCE_NOT_FOUND}（非静默跳过）
    假如 批量 assign 中某 sourceId 不存在
    当 系统返回结果
    那么 SHALL 在 results 里报 {sourceId, ok:false, errorCode:SOURCE_NOT_FOUND}（非静默跳过）

  @req:csv-parser-must-escape-cells @human
  场景: csv-cell-with-pipe
    - 必须成立：假如 CSV 单元格含 | 字符；当 parser 产出 markdown-table；那么 SHALL 转义为 \|（不破坏 table 结构）
    假如 CSV 单元格含 | 字符
    当 parser 产出 markdown-table
    那么 SHALL 转义为 \|（不破坏 table 结构）

  @req:convert-embedding-no-ready-on-fail @human
  场景: qa-to-source-fail
    - 必须成立：假如 embedding API 在 QA-to-source 过程中失败；当 source 状态更新；那么 系统 SHALL 标记 source 为 failed 而非 ready
    假如 embedding API 在 QA-to-source 过程中失败
    当 source 状态更新
    那么 系统 SHALL 标记 source 为 failed 而非 ready

  @req:per-source-qa-vector-search @human
  场景: large-source-qa
    - 必须成立：假如 一个 source 有 50 个 chunk；当 用户对该 source 提问；那么 系统 SHALL 通过向量检索返回最相关的 chunk 而非前 15 个
    假如 一个 source 有 50 个 chunk
    当 用户对该 source 提问
    那么 系统 SHALL 通过向量检索返回最相关的 chunk 而非前 15 个

  @req:summary-post-persists-auto-summary @human
  场景: post-writes-metadata
    - 必须成立：假如 ready 来源无或已有 autoSummary；当 客户端 POST summary；那么 系统 SHALL 生成并写入 metadata.autoSummary 且响应含完整摘要字段
    假如 ready 来源无或已有 autoSummary
    当 客户端 POST summary
    那么 系统 SHALL 生成并写入 metadata.autoSummary 且响应含完整摘要字段

  @req:summary-async-after-ready @human
  场景: ready-triggers-async-summary
    - 必须成立：假如 文件 ingest 即将完成；当 source 被标记为 ready；那么 系统 SHALL 在不阻塞响应的前提下尝试异步写入 autoSummary；失败不改 status
    假如 文件 ingest 即将完成
    当 source 被标记为 ready
    那么 系统 SHALL 在不阻塞响应的前提下尝试异步写入 autoSummary；失败不改 status
