# language: zh-CN
# capability: generation-core
# purpose: 定义统一生成主链路：上下文解析、结构化生成、后处理、引用映射、持久化，以及 QA/outputs 与 preference 的一致语义。
# scope: src/, tests/

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
    - 后处理 MUST 先于引用映射，且对非法 citation 索引做清洗并保持非阻塞。

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
    - QA answer 无 [N] 形式内联引用时 MUST 追加 [1] 兜底标记（对齐既有语义）

  @req:qa-low-similarity-empty @human
  场景: Low similarity no-evidence MUST return empty citations
    - 当 noEvidenceReason 为 low_similarity 时 MUST 返回 citations=[] 空数组，MUST NOT 返回检索到的 citations

  @req:qa-retrieve-before-generate @human
  场景: QA MUST gate retrieval then optionally generate
    - QA 管线 MUST 在进入 LLM 之前先解析 sourceIds：当 sourceIds 非空时 MUST 先做确定性检索并判定 evidence；当 sourceIds 缺失或为空且笔记本仍有来源时 MUST 跳过检索并以无引用（citations=[]）进入 LLM 生成；当笔记本无任何来源时 MUST 返回 evidence=false 且 reason=no_sources 且不进入 LLM。

  @req:qa-no-evidence-reasons @human
  场景: QA MUST produce 5 distinct no-evidence reasons
    - 当 evidence 为 false 时系统 MUST 从 5 种 reason 中确定一个并返回对应本地化回答：no_sources / embedding_empty / no_vector_hits / no_valid_chunks / low_similarity

  @req:qa-confidence-score @human
  场景: QA MUST compute and return confidence score
    - 当 evidence 为 true 时系统 MUST 计算并返回 confidence 置信度分数

  @req:r31 @human
  场景: generation-pipeline-order-is-stable
    - 必须成立：当 系统处理一次结构化输出生成请求；那么 各阶段 SHALL 按 `ResolveContext -> Generate -> Postprocess -> MapCitations -> Persist` 的顺序执行
    当 系统处理一次结构化输出生成请求
    那么 各阶段 SHALL 按 `ResolveContext -> Generate -> Postprocess -> MapCitations -> Persist` 的顺序执行

  @req:r89 @human
  场景: empty-source-ids-means-ungrounded-qa
    - 必须成立：假如 QA 请求 sourceIds 缺失或为空且笔记本有来源；当 系统处理该请求；那么 系统 SHALL 按 ungrounded 路径生成且不因空 scope 拒绝请求
    假如 QA 请求 sourceIds 缺失或为空且笔记本有来源
    当 系统处理该请求
    那么 系统 SHALL 按 ungrounded 路径生成且不因空 scope 拒绝请求

  @req:r126 @human
  场景: preference-maps-to-defaults
    - 必须成立：当 请求选择某个 `preference`；那么 系统 SHALL 从集中 tuning 表加载对应的检索与重试默认值
    当 请求选择某个 `preference`
    那么 系统 SHALL 从集中 tuning 表加载对应的检索与重试默认值

  @req:r162 @human
  场景: request-knobs-override-tuning
    - 必须成立：当 请求同时提供 `preference` 与显式 `topK/minScore` 等参数；那么 系统 SHALL 以显式参数覆盖 tuning 默认值
    当 请求同时提供 `preference` 与显式 `topK/minScore` 等参数
    那么 系统 SHALL 以显式参数覆盖 tuning 默认值

  @req:r197 @human
  场景: stream-and-non-stream-responses-are-consistent
    - 必须成立：当 同一输入分别使用流式与非流式 QA 路径；那么 系统 SHALL 在完成阶段返回一致的 citations/evidence/confidence 语义
    当 同一输入分别使用流式与非流式 QA 路径
    那么 系统 SHALL 在完成阶段返回一致的 citations/evidence/confidence 语义

  @req:r250 @human
  场景: invalid-citations-are-sanitized
    - 必须成立：当 模型输出包含非法 citation 索引或越界引用；那么 系统 SHALL 在后处理阶段清洗并保持流程非阻塞
    当 模型输出包含非法 citation 索引或越界引用
    那么 系统 SHALL 在后处理阶段清洗并保持流程非阻塞

  @req:r265 @human
  场景: missing-plugin-blocks-tool-output-generation
    - 必须成立：当 客户端请求生成某工具输出类型但服务器未安装/未启用对应插件；那么 系统 SHALL 返回失败响应
    当 客户端请求生成某工具输出类型但服务器未安装/未启用对应插件
    那么 系统 SHALL 返回失败响应

  @req:outputs-citation-mapping @human
  场景: llm-selects-subset
    - 必须成立：假如 LLM 输出 citations 为 [1,3]；当 管线映射 citation；那么 系统 SHALL 只附加第 1 和第 3 个检索 chunk 的 citation 而非全部
    假如 LLM 输出 citations 为 [1,3]
    当 管线映射 citation
    那么 系统 SHALL 只附加第 1 和第 3 个检索 chunk 的 citation 而非全部

  @req:outputs-citation-mapping @human
  场景: persisted-citation-dicts-are-camelcase
    - 必须成立：假如 content 树中某节点含 citations:[1]；当 管线持久化；那么 写入的 Citation dict SHALL 使用 sourceId/sourceName/chunkId 等 camelCase 键
    假如 content 树中某节点含 citations:[1]
    当 管线持久化
    那么 写入的 Citation dict SHALL 使用 sourceId/sourceName/chunkId 等 camelCase 键

  @req:outputs-rag @human
  场景: large_notebook
    - 必须成立：假如 notebook 含大量 chunk；当 用户生成输出；那么 系统 SHALL 仅检索 topK 相关 chunk 进入 prompt
    假如 notebook 含大量 chunk
    当 用户生成输出
    那么 系统 SHALL 仅检索 topK 相关 chunk 进入 prompt

  @req:outputs-rag @human
  场景: retrieval-throws
    - 必须成立：假如 retrieveWith 抛出错误；当 管线处理；那么 系统 SHALL 传播错误使请求失败，而非 dump 全量 chunk
    假如 retrieveWith 抛出错误
    当 管线处理
    那么 系统 SHALL 传播错误使请求失败，而非 dump 全量 chunk

  @req:outputs-postprocess @human
  场景: guide-missing-examples
    - 必须成立：假如 LLM 输出 GUIDE 类型但 examples 为空；当 后处理阶段；那么 系统 SHALL 为 examples 字段补默认值而非整体替换为 fallback
    假如 LLM 输出 GUIDE 类型但 examples 为空
    当 后处理阶段
    那么 系统 SHALL 为 examples 字段补默认值而非整体替换为 fallback

  @req:outputs-postprocess @human
  场景: generation-fails
    - 必须成立：假如 LLM 生成抛出异常；当 postprocess 阶段处理；那么 系统 SHALL 产出类型化 fallback 内容而非空结果
    假如 LLM 生成抛出异常
    当 postprocess 阶段处理
    那么 系统 SHALL 产出类型化 fallback 内容而非空结果

  @req:qa-context-stats @human
  场景: client-reads-context
    - 必须成立：假如 客户端读取 done 事件的 context 字段；当 响应构建；那么 系统 SHALL 使用 totalTokens/systemTokens 等 camelCase 字段名并含 compressed 布尔
    假如 客户端读取 done 事件的 context 字段
    当 响应构建
    那么 系统 SHALL 使用 totalTokens/systemTokens 等 camelCase 字段名并含 compressed 布尔

  @req:qa-context-stats @human
  场景: no-server-local-duplication
    - 必须成立：假如 retrieval 阶段计算 token 预算；当 server 构造 ContextStats 对象；那么 它 MUST 使用 shared 类型且 MUST NOT 在 server 本地重声明同域接口
    假如 retrieval 阶段计算 token 预算
    当 server 构造 ContextStats 对象
    那么 它 MUST 使用 shared 类型且 MUST NOT 在 server 本地重声明同域接口

  @req:qa-inline-citation-fallback @human
  场景: answer-no-brackets
    - 必须成立：假如 LLM answer 不含 [N]；当 后处理；那么 系统 SHALL 追加 [1] 兜底
    假如 LLM answer 不含 [N]
    当 后处理
    那么 系统 SHALL 追加 [1] 兜底

  @req:qa-low-similarity-empty @human
  场景: low-similarity
    - 必须成立：假如 检索 score 低于阈值；当 判定 no-evidence；那么 系统 SHALL 返回 citations=[]
    假如 检索 score 低于阈值
    当 判定 no-evidence
    那么 系统 SHALL 返回 citations=[]

  @req:qa-no-evidence-reasons @human
  场景: five-reasons
    - 必须成立：假如 检索结果空或无效；当 证据判定；那么 系统 SHALL 从 5 种 reason 中确定一个并返回对应本地化回答
    假如 检索结果空或无效
    当 证据判定
    那么 系统 SHALL 从 5 种 reason 中确定一个并返回对应本地化回答

  @req:qa-retrieve-before-generate @human
  场景: ungrounded-empty-selection
    - 必须成立：假如 笔记本有已索引来源但请求未提供 sourceIds（或为空数组）；当 用户提问；那么 系统 SHALL 跳过 RAG 检索进入 LLM 生成，且返回 citations=[]
    假如 笔记本有已索引来源但请求未提供 sourceIds（或为空数组）
    当 用户提问
    那么 系统 SHALL 跳过 RAG 检索进入 LLM 生成，且返回 citations=[]

  @req:qa-retrieve-before-generate @human
  场景: no-sources-case
    - 必须成立：假如 笔记本中无任何 source；当 用户提问；那么 系统 SHALL 返回 evidence=false 且 reason=no_sources 的标准化回答，不进入 LLM 生成
    假如 笔记本中无任何 source
    当 用户提问
    那么 系统 SHALL 返回 evidence=false 且 reason=no_sources 的标准化回答，不进入 LLM 生成

  @req:qa-confidence-score @human
  场景: high-evidence-case
    - 必须成立：假如 检索返回多个高相似度 chunk 跨越多 source；当 用户提问；那么 系统 SHALL 返回 evidence=true 且 confidence 为 0-1 分数
    假如 检索返回多个高相似度 chunk 跨越多 source
    当 用户提问
    那么 系统 SHALL 返回 evidence=true 且 confidence 为 0-1 分数
