# language: zh-CN
# capability: retrieval-and-cache
# purpose: 定义共享检索策略与缓存失效模型，覆盖 outputs/slides/qa 等路径的统一检索行为。该规范强调检索上下文一致性与可预测缓存失效，避免跨路径出现"同输入不同上下文"的漂移。

功能: retrieval-and-cache

  @req:r224
  规则: Retrieval strategy is shared across generation paths
    outputs 与 slides MUST 复用同一检索策略族（预算、去重、多样性、融合）。

    场景: outputs-and-slides-share-embed-strategy
      假如 已用记录型假策略覆盖 registry 的 embed 注册
      当 运行 apps/server/tests/rag/unified-retrieval.test.ts 分别驱动 outputs pipeline 与 studio getContext
      那么 两条路径都经同一 registry embed 注册发出检索
      而且 返回的 chunk 文本即该策略产出的内容
  @req:r225
  规则: Retrieval context obeys token budget and actually truncates
    检索上下文组装 MUST 受 token budget 约束；超预算时 MUST 实际截断或压缩上下文以适配预算（保留最高优先级块，边界块部分修剪）且 compressed 标记 SHALL 置 true；预算内上下文 SHALL 原样通过且 compressed 为 false；MUST NOT 仅设置 compressed 标记而将完整超长上下文传给 LLM。截断优先级 MUST 为 history→retrieval→recent→system→query。token 计数 MUST 使用项目 tokenizer（见 architecture-plugin-and-agent r14），MUST NOT 用字符数截断替代。

    场景: token-budget-truncates-by-priority
      假如 检索上下文装配就绪
      当 上下文超出 token 预算
      那么 按优先级保留高分块并部分修剪低分块且 compressed 标记置 true
      而且 修剪后不产生孤立 citation 引用（见 rag/context-window.test.ts）
  @req:r226
  规则: Multi-query retrieval is bounded
    启用 multi-query 时 MUST 受 seed 上限、融合策略与去重规则约束。

    场景: multi-query-seeds-capped
      假如 multi-query 扩展已启用
      当 运行 rag/multi-query.test.ts 的 SEED_CAP 用例
      那么 生成的 query seeds 数量不超过 seed 上限
      而且 融合与去重规则约束下不出现无界扩展
  @req:r227
  规则: Epoch-based cache invalidation is canonical
    sources/vector 相关缓存 MUST 基于 `sources_epoch` 与 `vector_epoch` 失效；epoch 递增在并发下 MUST 原子且单调递增。

    场景: epoch-bump-invalidates-cache
      假如 检索缓存中已有同 epoch 命中的条目
      当 运行 rag/cache.test.ts 的 bumpSourcesEpoch/bumpVectorEpoch 用例
      那么 对应 epoch 递增后旧缓存条目不再命中
      而且 epoch 递增在并发下原子且单调
  @req:r228
  规则: Optional retrieval assembly cache is versioned
    若启用检索组装缓存，key MUST 包含 epoch 版本信息以避免脏命中。

    场景: assembly-cache-key-carries-epoch
      假如 检索组装缓存已启用
      当 sources/vector epoch 递增后以相同输入读取缓存
      那么 缓存 key 因包含 epoch 版本信息而不命中旧值
      而且 缓存按 notebook 隔离互不污染（见 rag/cache.test.ts per-notebook 用例）
  @req:r229
  规则: Embed strategy converts distance to similarity
    Embed 检索策略 MUST 将 sqlite-vec 返回的 distance 转换为 similarity score (score = 1 - distance)。过滤 MUST 使用 score >= minScore 比较并按 score 降序排序（MUST NOT 直接用 distance 做 >= 比较，方向相反）。minScore 与 topK 的默认值 MUST 来自配置。

    场景: distance-converted-to-similarity
      假如 vec_chunks 以余弦距离返回受控向量的 KNN 命中
      当 运行 apps/server/tests/rag/embed-similarity.test.ts 的转换用例
      那么 每个命中的 score 满足 score = 1 - distance 且按 score 降序
      而且 过滤按 score >= minScore 执行（近 1 相似度保留，0.3 与约 0 的命中被丢弃）
  @req:r230
  规则: Chunking uses sliding window with configurable params
    文本分块 MUST 使用带重叠的滑动窗口（块大小 + 重叠量），分块参数 MUST 可配置（默认值对齐既有语义）；MUST NOT 使用无重叠的段落切分。

    场景: sliding-window-chunk-with-overlap
      假如 文本分块器以默认配置就绪
      当 运行 rag/chunker.test.ts 的 DEFAULT_CHUNKER_CONFIG 用例
      那么 块大小 512、重叠 102 且每块文本长度不超过 maxLen
      而且 分块参数可由配置覆盖且不退化为无重叠的段落切分
  @req:r231
  规则: Multi-query expansion with RRF fusion
    检索 MUST 支持 multi-query 扩展：按 outputType 生成 query seeds，多查询结果 RRF 融合（融合参数来自 config schema）。MUST 受 seedCap 限制避免无界扩展。

    场景: rrf-fuses-multi-query-seeds
      假如 已按 outputType 生成多个 query seeds
      当 运行 rag/multi-query.test.ts 的 rrfFuseSeeds 用例
      那么 多查询结果按 RRF（参数来自 config schema）融合为单一排序列表
      而且 融合结果受 seedCap 限制避免无界扩展
  @req:r232
  规则: Epoch cache wired to strategies and source mutations
    epoch 缓存组件 MUST 接线到各检索策略的 retrieve 入口。源增删改 MUST bump sources_epoch，向量重嵌 MUST bump vector_epoch。缓存 key MUST 包含 epoch 版本。MUST NOT 零调用（死代码）。

    场景: mutations-bump-epochs-invalidate-cache
      假如 已为笔记本写入一条检索缓存
      当 运行 apps/server/tests/rag/epoch-wiring.test.ts 的两个用例（HTTP 删除来源 / indexSource 重嵌）
      那么 来源删除 bump sources_epoch 后旧缓存不再命中
      而且 向量重嵌 bump vector_epoch 后旧缓存不再命中
  @req:r233
  规则: Studio retrieval MUST go through the unified RAG registry
    studio 生成检索 MUST 经统一 RAG registry 入口走 embed/fusion/diversity 路径，MUST NOT 用原始文本 slice 截断（对齐 qa/outputs 的检索路径一致性）

    场景: studio-context-via-unified-registry
      假如 studio slide 已选定来源
      当 运行 apps/server/tests/rag/unified-retrieval.test.ts 的 studio 用例
      那么 getContext 经 ragRegistry 的 embed 注册取得上下文（假策略文本原样返回）
      而且 检索按 slide 来源过滤并携带默认 tuning（topK=8、minScore=0.2）
  @req:r234
  规则: QA retrieval MUST be deterministic single-embed (no multi-query expansion)
    QA 检索 MUST 使用确定性单次 embed 检索路径（对齐既有语义），MUST NOT 在 QA 检索路径硬编码 multiQuery:true。

    场景: qa-retrieval-single-embed-no-multi-query
      假如 以记录型假策略驱动 retrieveAndJudge
      当 运行 apps/server/tests/qa/single-embed.test.ts 的 single-embed 用例
      那么 每次问答只发出一次检索调用且 multiQuery 为 false
      而且 检索 query 即原问题并按 sourceIds 过滤
  @req:r463

  规则: deterministic-retrieval
    当同一 question、同一组 sourceIds 与同一 embedding 下重复执行 QA 检索时，系统 SHALL 产出完全一致的结果（无 seed 扩张、无 RRF 归一化）。

    场景: qa-retrieval-deterministic-repeats
      假如 同一 question、同一组 sourceIds 与同一策略命中连续执行两次问答检索
      当 运行 apps/server/tests/qa/single-embed.test.ts 的 deterministic 用例
      那么 两次执行各只触发一次策略检索（无 seed 扩张）
      而且 citations/上下文/confidence 完全一致（无 RRF 归一化）
  @req:r235
  规则: QA and vector search MUST support sourceIds filtering
    QA 检索与向量 KNN MUST 支持通过 sourceIds 参数将检索范围限定到指定 source 子集；当 sourceIds 缺失或为空时 QA MUST 跳过向量检索（不得回退为全库检索）；minScore 阈值作为证据门控 MUST 可配置。

    场景: sourceids-filters-qa-and-knn
      假如 QA 检索与向量 KNN 支持 sourceIds 参数
      当 sourceIds 缺失或为空时执行 QA 检索（见 qa/c63-ungrounded.test.ts）
      那么 跳过向量检索且不回退为全库检索
      而且 指定 sourceIds 时检索范围限定到该子集并受可配置 minScore 门控（见 qa/low-similarity-passthrough.test.ts）
