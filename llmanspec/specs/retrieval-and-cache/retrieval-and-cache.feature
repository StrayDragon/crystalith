# language: zh-CN
# capability: retrieval-and-cache
# purpose: 定义共享检索策略与缓存失效模型，覆盖 outputs/slides/qa 等路径的统一检索行为。该规范强调检索上下文一致性与可预测缓存失效，避免跨路径出现"同输入不同上下文"的漂移。
# scope: src/, tests/

功能: retrieval-and-cache

  @req:r43 @human
  场景: Retrieval strategy is shared across generation paths
    - outputs 与 slides MUST 复用同一检索策略族（预算、去重、多样性、融合）。

  @req:r101 @human
  场景: Retrieval context obeys token budget and actually truncates
    - 检索上下文组装 MUST 受 token budget 约束；超预算时 MUST 实际截断或压缩上下文以适配预算（保留最高优先级块，边界块部分修剪），MUST NOT 仅设置 compressed 标记而将完整超长上下文传给 LLM。截断优先级 MUST 为 history→retrieval→recent→system→query。token 计数 MUST 使用项目 tokenizer（见 architecture-plugin-and-agent r221），MUST NOT 用字符数截断替代。

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
    - Embed 检索策略 MUST 将 sqlite-vec 返回的 distance 转换为 similarity score (score = 1 - distance)。过滤 MUST 使用 score >= minScore 比较（MUST NOT 直接用 distance 做 >= 比较，方向相反）。minScore 与 topK 的默认值 MUST 来自配置。

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

  @req:retrieval-source-scoping @human
  场景: QA and vector search MUST support sourceIds filtering
    - QA 检索与向量 KNN MUST 支持通过 sourceIds 参数将检索范围限定到指定 source 子集；当 sourceIds 缺失或为空时 QA MUST 跳过向量检索（不得回退为全库检索）；minScore 阈值作为证据门控 MUST 可配置。

  @req:r43 @human
  场景: shared-retrieval-across-paths
    - 必须成立：当 outputs 与 slides 路径执行检索；那么 系统 SHALL 复用同一检索策略族（预算/去重/多样性/融合）
    当 outputs 与 slides 路径执行检索
    那么 系统 SHALL 复用同一检索策略族（预算/去重/多样性/融合）

  @req:r101 @human
  场景: over-budget-truncates
    - 必须成立：假如 组装的检索上下文 token 数超过配置的 maxTokens 预算；当 系统为 LLM 生成构建上下文；那么 传给 LLM 的上下文 SHALL 被截断至预算内（保留最高优先级块、边界块部分修剪）且 compressed 标记 SHALL 为 true
    假如 组装的检索上下文 token 数超过配置的 maxTokens 预算
    当 系统为 LLM 生成构建上下文
    那么 传给 LLM 的上下文 SHALL 被截断至预算内（保留最高优先级块、边界块部分修剪）且 compressed 标记 SHALL 为 true

  @req:r101 @human
  场景: under-budget-passthrough
    - 必须成立：假如 组装的上下文在预算内；当 系统构建上下文；那么 SHALL 不截断且 compressed=false，上下文原样通过
    假如 组装的上下文在预算内
    当 系统构建上下文
    那么 SHALL 不截断且 compressed=false，上下文原样通过

  @req:r101 @human
  场景: priority-order-and-token-counting
    - 必须成立：假如 上下文超预算需要裁剪块；当 选择丢弃/修剪哪些块；那么 系统 SHALL 遵循优先级顺序（history→retrieval→recent→system→query）且 SHALL 使用 tokenizer 计数而非字符数
    假如 上下文超预算需要裁剪块
    当 选择丢弃/修剪哪些块
    那么 系统 SHALL 遵循优先级顺序（history→retrieval→recent→system→query）且 SHALL 使用 tokenizer 计数而非字符数

  @req:r138 @human
  场景: multi-query-remains-bounded
    - 必须成立：当 启用 multi-query 检索；那么 系统 SHALL 遵守 seed 上限、融合策略与去重规则以保持有界
    当 启用 multi-query 检索
    那么 系统 SHALL 遵守 seed 上限、融合策略与去重规则以保持有界

  @req:r174 @human
  场景: epoch-invalidates-stale-cache
    - 必须成立：当 sources 或 vector 发生变更并 bump epoch；那么 系统 SHALL 基于 `sources_epoch`/`vector_epoch` 使相关缓存失效以避免脏命中
    当 sources 或 vector 发生变更并 bump epoch
    那么 系统 SHALL 基于 `sources_epoch`/`vector_epoch` 使相关缓存失效以避免脏命中

  @req:r174 @human
  场景: concurrent-epoch-bumps-are-safe
    - 必须成立：当 多个并发请求同时触发 epoch 递增；那么 系统 SHALL 保证递增操作原子且单调递增
    当 多个并发请求同时触发 epoch 递增
    那么 系统 SHALL 保证递增操作原子且单调递增

  @req:r234 @human
  场景: retrieval-assembly-cache-key-is-versioned
    - 必须成立：当 系统启用检索组装缓存并存取 cache；那么 cache key SHALL 包含 epoch 版本信息以避免命中旧上下文
    当 系统启用检索组装缓存并存取 cache
    那么 cache key SHALL 包含 epoch 版本信息以避免命中旧上下文

  @req:r254 @human
  场景: distance-to-score-conversion
    - 必须成立：假如 sqlite-vec 返回 distance=0.3 的 chunk；当 Embed 检索策略执行；那么 score=0.7，按 score>=minScore 过滤（minScore 来自配置），score desc 排序
    假如 sqlite-vec 返回 distance=0.3 的 chunk
    当 Embed 检索策略执行
    那么 score=0.7，按 score>=minScore 过滤（minScore 来自配置），score desc 排序

  @req:r267 @human
  场景: sliding-window-chunking
    - 必须成立：假如 5000 字文档入库；当 分块；那么 产生多个相邻重叠 chunk（块大小与重叠量由配置给出）
    假如 5000 字文档入库
    当 分块
    那么 产生多个相邻重叠 chunk（块大小与重叠量由配置给出）

  @req:r60 @human
  场景: rrf-fusion-bounded
    - 必须成立：假如 FAQ 类型输出 + 用户查询；当 multi-query 扩展；那么 生成 2-3 个 seed query，各检索后 RRF 融合 top 结果且受 seedCap 约束
    假如 FAQ 类型输出 + 用户查询
    当 multi-query 扩展
    那么 生成 2-3 个 seed query，各检索后 RRF 融合 top 结果且受 seedCap 约束

  @req:r66 @human
  场景: epoch-cache-invalidates-on-mutation
    - 必须成立：假如 notebook 新增源后检索；当 epoch 缓存查询；那么 sources_epoch 变更，缓存失效，重新检索
    假如 notebook 新增源后检索
    当 epoch 缓存查询
    那么 sources_epoch 变更，缓存失效，重新检索

  @req:studio-rag-through-registry @human
  场景: generation-retrieves-context
    - 必须成立：假如 studio 生成需要上下文；当 检索阶段；那么 系统 SHALL 调用统一 RAG registry 入口而非直接 join chunks+sources 后截断
    假如 studio 生成需要上下文
    当 检索阶段
    那么 系统 SHALL 调用统一 RAG registry 入口而非直接 join chunks+sources 后截断

  @req:qa-retrieval-must-be-deterministic @human
  场景: deterministic-retrieval
    - 必须成立：假如 同一 question + 同一组 sourceIds + 同一 embedding；当 系统执行 QA 检索两次；那么 两次产出 SHALL 完全一致（无 seed 扩张、无 RRF 归一化）
    假如 同一 question + 同一组 sourceIds + 同一 embedding
    当 系统执行 QA 检索两次
    那么 两次产出 SHALL 完全一致（无 seed 扩张、无 RRF 归一化）

  @req:retrieval-source-scoping @human
  场景: empty-skips-retrieval
    - 必须成立：假如 笔记本有多个 source；当 QA 请求未提供 sourceIds 或为空数组；那么 系统 SHALL 不执行向量检索，且不得返回任何检索 hit
    假如 笔记本有多个 source
    当 QA 请求未提供 sourceIds 或为空数组
    那么 系统 SHALL 不执行向量检索，且不得返回任何检索 hit

  @req:retrieval-source-scoping @human
  场景: scoped-knn
    - 必须成立：假如 notebook 有多个 source 的向量；当 searchVectors 传入 sourceIds=[2,3]；那么 系统 SHALL 仅返回 source 2 和 3 的 KNN 结果
    假如 notebook 有多个 source 的向量
    当 searchVectors 传入 sourceIds=[2,3]
    那么 系统 SHALL 仅返回 source 2 和 3 的 KNN 结果

  @req:retrieval-source-scoping @human
  场景: scoped-qa
    - 必须成立：假如 notebook 有 5 个 source；当 QA 请求指定 sourceIds=[2,4]；那么 系统 SHALL 仅在 source 2 和 4 的 chunk 范围内检索
    假如 notebook 有 5 个 source
    当 QA 请求指定 sourceIds=[2,4]
    那么 系统 SHALL 仅在 source 2 和 4 的 chunk 范围内检索
