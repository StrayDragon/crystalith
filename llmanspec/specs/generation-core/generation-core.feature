# language: zh-CN
# capability: generation-core
# purpose: 定义统一生成主链路：上下文解析、结构化生成、后处理、引用映射、持久化，以及 QA/outputs 与 preference 的一致语义。
# scope: apps/server/src/features/outputs/, packages/shared/src/schemas/

功能: generation-core

  @req:r160
  规则: Output generation follows deterministic node pipeline
    结构化输出 MUST 遵循 `ResolveContext -> Generate -> Postprocess -> MapCitations -> Persist` 逻辑顺序。
  @req:r161
  规则: Source scope is explicit and validated
    生成/问答请求中的 sourceIds 语义 MUST 明确且可校验：非空列表 MUST 限定检索范围；缺失或空列表对 QA 表示 ungrounded（无 RAG）；非法或越权 id MUST 返回错误。

    场景: source-scope-validated
      假如 笔记本中已存在 ready 状态的来源
      当 retrieveAndJudge 收到缺失或空数组的 sourceIds
      那么 进入 ungrounded 路径并返回 citations 空数组与空 context
      而且非空 sourceIds 使 outputs pipeline 仅按所选来源解析检索 chunk
  @req:r162
  规则: Preference tuning is table-driven
    `preference` MUST 通过集中 tuning 表映射到检索与重试默认值。

    场景: preference-maps-through-tuning-table
      假如 已用记录型假 embed 策略覆盖 registry 的 embed 注册
      当 运行 apps/server/tests/outputs/preference-tuning.test.ts 的 preference 用例
      那么 quality/speed 分别映射到 tuning 表对应 topK
      而且 缺省 preference 时落到 quality 行
  @req:r163
  规则: Explicit request knobs override defaults
    请求显式给定 `topK/minScore` 等参数时 MUST 覆盖 preference 默认值。

    场景: request-knobs-override-tuning-defaults
      假如 请求显式携带 topK=7 与 minScore=0.55（preference=speed）
      当 运行 apps/server/tests/outputs/preference-tuning.test.ts 的 explicit knobs 用例
      那么 检索按 topK=7 与 minScore=0.55 执行，覆盖 tuning 表值
      而且 缺省 minScore 时落到检索默认值
  @req:r164
  规则: QA stream and non-stream completion logic is shared
    流式与非流式 QA MUST 复用同一完成阶段逻辑，保证 citations/evidence/confidence 一致。
  @req:r165
  规则: Postprocessing is deterministic and citation-safe
    后处理 MUST 先于引用映射，且对非法 citation 索引做清洗并保持非阻塞。本条为 citation 清洗 postprocess 的 canonical 约束（其他 capability 以引用表达，如 typed-generation-framework outputs-citations-must-be-sanitized）。

    场景: citation-sanitize-nonblocking
      当 sanitizeCitationsIndices 遍历生成结果内嵌的 citation 数字索引
      那么 越界、重复与非整数索引被剔除并记录 warnings，合法唯一索引保持不变
      而且清洗结果携带 _postprocessed 标记与 warnings，不阻塞生成主链路
  @req:r166
  规则: Tool output types require a corresponding OutputTypePlugin
    对于 FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING 等“工具输出类型”，系统 MUST 要求存在可用的 `OutputTypePlugin` 才能生成结构化输出；当插件缺失/禁用/加载失败时，生成请求 MUST 失败并返回可执行的恢复提示，使用统一错误信封（见 workspace-api-contract r346），`details` MUST 包含 `outputType` 与推荐的 `requiredPluginId`（例如 `output-faq`），`message` MUST 可直接面向用户显示。
  @req:r167
  规则: Outputs MUST map LLM citation indices to full citation objects
    outputs 生成管线 MUST 将 LLM 输出的数字 citation 索引映射回完整 Citation 对象（仅附加被引用的 chunk）：递归遍历 content 树，把 citations 数字索引数组替换为完整 camelCase Citation dict，并持久化映射后的 content，同时返回扁平 citations 数组。

    场景: cited-citations-mapped
      当 collectCitedCitations 递归遍历 content 树叶子节点内嵌的 citations
      那么 仅被引用的 chunk 以完整 camelCase Citation 对象收集并按 chunkId 首次出现去重
      而且检索超集中未被引用的 chunk 不进入最终 citations 数组
  @req:r168
  规则: Outputs RAG retrieval with failure propagation
    outputs 生成 MUST 通过 RAG 检索获取相关上下文（topK 由生成偏好调节），MUST NOT dump 全部 chunk 以避免上下文窗口溢出；检索失败 MUST 传播错误使请求失败，MUST NOT 回退为选取 notebook 全部 chunk（违背检索子集意图）。

    场景: retrieval-failure-propagates-or-scoped-fallback
      假如 embed 策略检索抛错
      当 运行 apps/server/tests/outputs/preference-tuning.test.ts 的 retrieval failure 用例
      那么 未选来源时请求以统一错误信封失败（Output retrieval failed）
      而且 已选来源时直接回退仅取所选来源的 chunk，不混入未选来源或全库 chunk
  @req:r169
  规则: Outputs postprocess MUST backfill per-type fields and fall back
    outputs 后处理 MUST 对每个输出类型逐字段补默认值（如 GUIDE 的 examples/exercises、MINDMAP 的 children），而非仅做顶层空检查后整体替换；生成失败时 MUST 产出类型化 fallback 内容而非空结果。

    场景: per-type-backfill-and-fallback
      当 ensureMinimumContentFields 处理 GUIDE 或 MINDMAP 的生成内容
      那么 缺失的嵌套字段被逐项补默认值（GUIDE 的 objective/keyPoints、MINDMAP 的 children）
      而且生成失败时 generateFallbackContent 产出以用户 prompt 为标题的类型化 fallback 内容
  @req:r170
  规则: ContextStats contract: shared SSOT with camelCase fields and real token counts
    ContextStats 合约类型 MUST 定义于 packages/shared（Zod SSOT），字段 MUST 为 camelCase：totalTokens/systemTokens/historyTokens/retrievalTokens/queryTokens/maxTokens/compressed（MUST NOT 使用无后缀的 total/system 等）；token 数值 MUST 来自真实 token 计数；compressed 标志 SHALL 在历史被截断/摘要时为 true。MUST NOT 在 server 本地平行定义同域类型。

    场景: contextstats-camelcase-real-counts
      当 retrieveAndJudge 返回 contextStats
      那么 字段为 camelCase（totalTokens/systemTokens/historyTokens/retrievalTokens/queryTokens/maxTokens/compressed）
      而且 systemTokens 来自真实 token 计数且计入 totalTokens
  @req:r171
  规则: QA MUST ensure inline citations when missing
    有证据路径（citations 非空）下，QA answer 无 [N] 形式内联引用时 MUST 追加 [1] 兜底标记（对齐既有语义）；无证据路径 MUST 保持 citations 为空且不注入兜底标记。

    场景: inline-citation-backfill
      假如 QA 处于有证据路径且 answer 不含 [N] 形式内联引用
      当 运行 apps/server/tests/qa/inline-citations.test.ts 的 backfill 用例
      那么 answer 追加 [1] 兜底标记，已含内联引用的 answer 原样保留
      而且 无证据路径（citations 为空）不注入兜底标记
  @req:r172
  规则: Low similarity no-evidence MUST return empty citations
    当 noEvidenceReason 为 low_similarity 时 MUST 返回 citations=[] 空数组，MUST NOT 返回检索到的 citations

    场景: low-similarity-empty-citations
      当 检索命中分数低于相似度阈值并判定为 low_similarity 无证据
      那么 返回 citations 空数组且 confidence 为 0
      而且检索到的低分 chunk 不作为 citations 返回
  @req:r173
  规则: QA MUST gate retrieval then optionally generate
    QA 管线 MUST 在进入 LLM 之前先解析 sourceIds：当 sourceIds 非空时 MUST 先做确定性检索并判定 evidence；当 sourceIds 缺失或为空时 MUST 跳过检索并以无引用（citations=[]）进入 LLM 生成，无论笔记本是否已有来源。本条持有“空 selection→ungrounded”断言的 canonical 表述。

    场景: retrieval-then-generate-gate
      当 QA 请求携带非空 sourceIds 进入 retrieveAndJudge
      那么 先执行确定性检索并判定 evidence，再携带证据进入 LLM 生成
      而且 sourceIds 缺失或为空时跳过检索，以 citations 空数组直接进入 LLM 生成
  @req:r174
  规则: QA MUST produce distinct no-evidence reasons
    当 evidence 为 false 时系统 MUST 从以下 reason 中确定一个并返回对应本地化回答：embedding_empty / no_vector_hits / no_valid_chunks / low_similarity

    场景: no-evidence-reasons-distinct-and-localized
      假如 分别以检索抛错、空命中与幽灵 chunk 假策略驱动 retrieveAndJudge
      当 运行 apps/server/tests/qa/no-evidence-reasons.test.ts 的各 reason 用例
      那么 embedding_empty/no_vector_hits/no_valid_chunks 各返回对应 reason 与本地化回答
      而且 四个规范 reason 的本地化回答两两不同且非空（low_similarity 含于映射表）
  @req:r175
  规则: QA MUST compute and return confidence score
    当 evidence 为 true 时系统 MUST 计算并返回 confidence 置信度分数（0–1 区间）

    场景: confidence-scored-zero-to-one
      当 evidence 为 true 且 citations 已解析
      那么 computeConfidence 依据相似度、覆盖度与引用数计算 0–1 区间的 confidence 并随响应返回
