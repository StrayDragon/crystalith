# language: zh-CN
# capability: global-search
# purpose: 定义跨笔记本/笔记本内两档范围的知识库搜索产品面：固定 hybrid 的搜索服务与单端点 API、索引对象泛化（产出自动入索引且既有引用语义零变化）、中文关键词召回质量、索引不可用期的降级语义与性能预算。

功能: global-search

  @req:r484
  规则: Global search is a single hybrid endpoint with scoped results
    全局搜索 MUST 由单一端点承载：请求携带查询词与范围（全局或指定笔记本），默认范围为全局（跨全部笔记本，notebooks 为平铺结构，无树遍历）。搜索路径 MUST 固定为语义与关键词双通道融合，MUST NOT 读取单笔记本的检索策略配置（全局搜索不被单笔记本配置劫持）。结果条目 MUST 携带分组上下文（所属笔记本、对象来源类型、模态）与可跳转引用（来源块引用 / 产出引用），并附带按笔记本与来源类型的分组计数。topK 与分数阈值 MUST 可配置且请求可覆盖。检索范围 MUST 覆盖全部已索引对象类型（来源块与产出），调用方可按来源类型过滤。

    场景: global-scope-crosses-notebooks
      假如 两个笔记本各有匹配同一查询的已索引来源
      当 以全局范围发起搜索（搜索 API 集成用例）
      那么 结果同时包含两个笔记本的命中且分组计数正确

    场景: notebook-scope-is-limited
      假如 另一笔记本存在更相关的命中
      当 以指定笔记本范围发起搜索
      那么 结果只含该笔记本的命中

    场景: results-carry-context-and-jump-references
      假如 命中条目分属来源块与产出两种来源类型
      当 发起搜索
      那么 每条结果携带笔记本上下文、来源类型与模态
      而且 来源块条目携带可定位到具体块的引用，产出条目携带可定位到具体产出的引用

  @req:r485
  规则: Outputs are auto-indexed as hidden derived entries
    产出（outputs 表全部类型）生成成功后 MUST 自动以派生隐藏条目入索引：派生条目 MUST NOT 出现在任何用户可见的来源列表/详情/统计面。索引 MUST 在生成响应返回前完成（响应即代表已可搜）。嵌入失败 MUST NOT 使生成请求失败：产出照常返回，派生条目标记失败与错误信息，且失败数量 MUST 可经索引状态面查询，索引重建为其恢复手段。产出删除 MUST 级联清理其派生条目的全部块、向量与关键词索引，不留孤儿。索引重建 MUST 覆盖派生条目（与普通来源同权重嵌）。

    场景: output-indexed-synchronously-and-hidden
      假如 一次产出生成成功完成（假 embed）
      当 生成响应返回后立即以全局范围搜索该产出内容
      那么 该产出可被搜到且结果来源类型为产出
      而且 来源列表查询不包含其派生条目

    场景: embed-failure-keeps-generation-and-is-observable
      假如 嵌入服务不可用
      当 生成一个产出
      那么 生成请求成功返回且派生条目为失败态
      而且 索引状态面可见失败计数

    场景: output-delete-cascades-cleanly
      假如 某产出已自动入索引
      当 删除该产出
      那么 其派生条目、块、向量与关键词索引全部清理
      而且 全局搜索不再命中该产出

  @req:r486
  规则: Existing retrieval callers see source-origin chunks only
    既有检索消费方（QA 对话、outputs 生成、studio、单源问答、research 检索工具）MUST 默认只检索来源类型为 source 的块——产出入索引后既有引用与证据语义零变化。该过滤 MUST 在检索的向量与关键词两通道统一生效，而非调用方各自后置过滤。

    场景: retrieval-defaults-to-source-origin
      假如 同一笔记本内存在来源块与产出块同时命中某查询
      当 既有消费方走默认检索（QA 或生成管线集成用例）
      那么 证据与引用只来自来源块
      而且 显式请求全来源类型的只有全局搜索服务

  @req:r487
  规则: CJK keyword retrieval matches short Chinese queries
    关键词通道 MUST 对中文查询具备召回能力：短中文词（两字词）与更长短语查询 MUST 能经关键词通道命中含该词的块并按相关性排序；非中文（拉丁词、代码标识符）查询 MUST 保持可命中。该能力 MUST 对索引期内全部块生效（含历史块的迁移回填），分词实现细节不构成合约。

    场景: two-char-chinese-query-matches
      假如 索引中存在包含某两字中文词的块（中文召回用例）
      当 以该两字词发起关键词检索
      那么 命中该块且按关键词相关性排序

    场景: migrated-legacy-chunks-are-searchable
      假如 升级前已存在的中文块
      当 升级后以其中文内容发起关键词检索
      那么 该块可被命中（历史块回填生效）

  @req:r488
  规则: Search degrades explicitly to keyword-only when the index is unavailable
    索引不可用（重建中、维度不匹配、中断态）或嵌入服务不可用时，搜索 MUST NOT 整体失败：关键词通道照常返回结果，响应 MUST 携带明确的降级原因标志。MUST NOT 出现无提示的静默降级（缺语义通道却无标志），MUST NOT 以索引不可用为由拒绝搜索请求。

    场景: rebuilding-returns-keyword-results-with-flag
      假如 索引处于重建中
      当 发起搜索
      那么 返回关键词通道结果且响应携带索引重建降级标志

    场景: embed-unavailable-degrades-with-flag
      假如 嵌入服务不可用
      当 发起搜索
      那么 返回关键词通道结果且响应携带嵌入不可用降级标志

  @req:r489
  规则: Global search latency is bounded and documented
    全局范围搜索的延迟 MUST 有界：延迟预算 MUST 可配置，超预算的行为 MUST 可观测（文档化边界），topK MUST 有上限约束。文档 MUST 写明索引对象范围（哪些来源与产出会被搜到）与不可用期的行为边界。

    场景: budget-is-configurable-and-enforced
      假如 配置了搜索延迟预算与 topK 上限（config 解析用例）
      当 读取配置并发起超上限 topK 的搜索请求
      那么 配置项被解析生效且请求被约束在上限内
