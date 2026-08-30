# language: zh-CN
# capability: retrieval-and-cache
# purpose: 定义共享检索策略与缓存失效模型，覆盖 outputs/slides/qa 等路径的统一检索行为。该规范强调检索上下文一致性与可预测缓存失效，避免跨路径出现"同输入不同上下文"的漂移。
# scope: apps/server/src/rag/

功能: retrieval-and-cache

  @req:r43 @human
  场景: Retrieval strategy is shared across generation paths
    - outputs 与 slides MUST 复用同一检索策略族（预算、去重、多样性、融合）。

  @req:r101 @human
  场景: Retrieval context obeys token budget and actually truncates
    - 检索上下文组装 MUST 受 token budget 约束；超预算时 MUST 实际截断或压缩上下文以适配预算（保留最高优先级块，边界块部分修剪）且 compressed 标记 SHALL 置 true；预算内上下文 SHALL 原样通过且 compressed 为 false；MUST NOT 仅设置 compressed 标记而将完整超长上下文传给 LLM。截断优先级 MUST 为 history→retrieval→recent→system→query。token 计数 MUST 使用项目 tokenizer（见 architecture-plugin-and-agent r221），MUST NOT 用字符数截断替代。

  @req:r138 @human
  场景: Multi-query retrieval is bounded
    - 启用 multi-query 时 MUST 受 seed 上限、融合策略与去重规则约束。

  @req:r174 @human
  场景: Epoch-based cache invalidation is canonical
    - sources/vector 相关缓存 MUST 基于 `sources_epoch` 与 `vector_epoch` 失效；epoch 递增在并发下 MUST 原子且单调递增。

  @req:r234 @human
  场景: Optional retrieval assembly cache is versioned
    - 若启用检索组装缓存，key MUST 包含 epoch 版本信息以避免脏命中。

  @req:r254 @human
  场景: Embed strategy converts distance to similarity
    - Embed 检索策略 MUST 将 sqlite-vec 返回的 distance 转换为 similarity score (score = 1 - distance)。过滤 MUST 使用 score >= minScore 比较并按 score 降序排序（MUST NOT 直接用 distance 做 >= 比较，方向相反）。minScore 与 topK 的默认值 MUST 来自配置。

  @req:r267 @human
  场景: Chunking uses sliding window with configurable params
    - 文本分块 MUST 使用带重叠的滑动窗口（块大小 + 重叠量），分块参数 MUST 可配置（默认值对齐既有语义）；MUST NOT 使用无重叠的段落切分。

  @req:r60 @human
  场景: Multi-query expansion with RRF fusion
    - 检索 MUST 支持 multi-query 扩展：按 outputType 生成 query seeds，多查询结果 RRF 融合（融合参数来自 config schema）。MUST 受 seedCap 限制避免无界扩展。

  @req:r66 @human
  场景: Epoch cache wired to strategies and source mutations
    - epoch 缓存组件 MUST 接线到各检索策略的 retrieve 入口。源增删改 MUST bump sources_epoch，向量重嵌 MUST bump vector_epoch。缓存 key MUST 包含 epoch 版本。MUST NOT 零调用（死代码）。

  @req:studio-rag-through-registry @human
  场景: Studio retrieval MUST go through the unified RAG registry
    - studio 生成检索 MUST 经统一 RAG registry 入口走 embed/fusion/diversity 路径，MUST NOT 用原始文本 slice 截断（对齐 qa/outputs 的检索路径一致性）

  @req:qa-retrieval-must-be-deterministic @human
  场景: QA retrieval MUST be deterministic single-embed (no multi-query expansion)
    - QA 检索 MUST 使用确定性单次 embed 检索路径（对齐既有语义），MUST NOT 在 QA 检索路径硬编码 multiQuery:true。

  @req:qa-retrieval-must-be-deterministic @human
  场景: deterministic-retrieval
    - 当同一 question、同一组 sourceIds 与同一 embedding 下重复执行 QA 检索时，系统 SHALL 产出完全一致的结果（无 seed 扩张、无 RRF 归一化）。

  @req:retrieval-source-scoping @human
  场景: QA and vector search MUST support sourceIds filtering
    - QA 检索与向量 KNN MUST 支持通过 sourceIds 参数将检索范围限定到指定 source 子集；当 sourceIds 缺失或为空时 QA MUST 跳过向量检索（不得回退为全库检索）；minScore 阈值作为证据门控 MUST 可配置。
