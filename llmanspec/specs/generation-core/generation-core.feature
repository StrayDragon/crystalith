# language: zh-CN
# capability: generation-core
# purpose: 定义统一生成主链路：上下文解析、结构化生成、后处理、引用映射、持久化，以及 QA/outputs 与 preference 的一致语义。
# scope: apps/server/src/features/outputs/, packages/shared/src/schemas/

功能: generation-core

  @req:r31 @human
  场景: Output generation follows deterministic node pipeline
    - 结构化输出 MUST 遵循 `ResolveContext -> Generate -> Postprocess -> MapCitations -> Persist` 逻辑顺序。

  @req:r89 @human
  场景: Source scope is explicit and validated
    - 生成/问答请求中的 sourceIds 语义 MUST 明确且可校验：非空列表 MUST 限定检索范围；缺失或空列表对 QA 表示 ungrounded（无 RAG）；非法或越权 id MUST 返回错误。

  @req:r126 @human
  场景: Preference tuning is table-driven
    - `preference` MUST 通过集中 tuning 表映射到检索与重试默认值。

  @req:r162 @human
  场景: Explicit request knobs override defaults
    - 请求显式给定 `topK/minScore` 等参数时 MUST 覆盖 preference 默认值。

  @req:r197 @human
  场景: QA stream and non-stream completion logic is shared
    - 流式与非流式 QA MUST 复用同一完成阶段逻辑，保证 citations/evidence/confidence 一致。

  @req:r250 @human
  场景: Postprocessing is deterministic and citation-safe
    - 后处理 MUST 先于引用映射，且对非法 citation 索引做清洗并保持非阻塞。本条为 citation 清洗 postprocess 的 canonical 约束（其他 capability 以引用表达，如 typed-generation-framework outputs-citations-must-be-sanitized）。

  @req:r265 @human
  场景: Tool output types require a corresponding OutputTypePlugin
    - 对于 FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING 等“工具输出类型”，系统 MUST 要求存在可用的 `OutputTypePlugin` 才能生成结构化输出；当插件缺失/禁用/加载失败时，生成请求 MUST 失败并返回可执行的恢复提示，使用统一错误信封（见 workspace-api-contract r151），`details` MUST 包含 `outputType` 与推荐的 `requiredPluginId`（例如 `output-faq`），`message` MUST 可直接面向用户显示。

  @req:outputs-citation-mapping @human
  场景: Outputs MUST map LLM citation indices to full citation objects
    - outputs 生成管线 MUST 将 LLM 输出的数字 citation 索引映射回完整 Citation 对象（仅附加被引用的 chunk）：递归遍历 content 树，把 citations 数字索引数组替换为完整 camelCase Citation dict，并持久化映射后的 content，同时返回扁平 citations 数组。

  @req:outputs-rag @human
  场景: Outputs RAG retrieval with failure propagation
    - outputs 生成 MUST 通过 RAG 检索获取相关上下文（topK 由生成偏好调节），MUST NOT dump 全部 chunk 以避免上下文窗口溢出；检索失败 MUST 传播错误使请求失败，MUST NOT 回退为选取 notebook 全部 chunk（违背检索子集意图）。

  @req:outputs-postprocess @human
  场景: Outputs postprocess MUST backfill per-type fields and fall back
    - outputs 后处理 MUST 对每个输出类型逐字段补默认值（如 GUIDE 的 examples/exercises、MINDMAP 的 children），而非仅做顶层空检查后整体替换；生成失败时 MUST 产出类型化 fallback 内容而非空结果。

  @req:qa-context-stats @human
  场景: ContextStats contract: shared SSOT with camelCase fields and real token counts
    - ContextStats 合约类型 MUST 定义于 packages/shared（Zod SSOT），字段 MUST 为 camelCase：totalTokens/systemTokens/historyTokens/retrievalTokens/queryTokens/maxTokens/compressed（MUST NOT 使用无后缀的 total/system 等）；token 数值 MUST 来自真实 token 计数；compressed 标志 SHALL 在历史被截断/摘要时为 true。MUST NOT 在 server 本地平行定义同域类型。

  @req:qa-inline-citation-fallback @human
  场景: QA MUST ensure inline citations when missing
    - 有证据路径（citations 非空）下，QA answer 无 [N] 形式内联引用时 MUST 追加 [1] 兜底标记（对齐既有语义）；无证据路径 MUST 保持 citations 为空且不注入兜底标记。

  @req:qa-low-similarity-empty @human
  场景: Low similarity no-evidence MUST return empty citations
    - 当 noEvidenceReason 为 low_similarity 时 MUST 返回 citations=[] 空数组，MUST NOT 返回检索到的 citations

  @req:qa-retrieve-before-generate @human
  场景: QA MUST gate retrieval then optionally generate
    - QA 管线 MUST 在进入 LLM 之前先解析 sourceIds：当 sourceIds 非空时 MUST 先做确定性检索并判定 evidence；当 sourceIds 缺失或为空时 MUST 跳过检索并以无引用（citations=[]）进入 LLM 生成，无论笔记本是否已有来源。本条持有“空 selection→ungrounded”断言的 canonical 表述。

  @req:qa-no-evidence-reasons @human
  场景: QA MUST produce distinct no-evidence reasons
    - 当 evidence 为 false 时系统 MUST 从以下 reason 中确定一个并返回对应本地化回答：embedding_empty / no_vector_hits / no_valid_chunks / low_similarity

  @req:qa-confidence-score @human
  场景: QA MUST compute and return confidence score
    - 当 evidence 为 true 时系统 MUST 计算并返回 confidence 置信度分数（0–1 区间）
