# language: zh-CN
# capability: deep-research-runtime
# purpose: ResearchRun HTTP/SSE 运行时：创建/列表/图命令口/报告/revisions 与编排约束（省略字段时外网优先默认）
# scope: apps/server/src/features/research/, packages/shared/src/schemas/

功能: deep-research-runtime

  @req:r300 @human
  场景: ResearchRun is process SSOT
    - 系统 MUST 以 notebook 作用域的 ResearchRun 作为深研过程 SSOT（图、checkpoint、权威报告与 citation map 挂在 Run 上）；MUST NOT 把长跑过程态的唯一权威塞进 Output 行。

  @req:r301 @human
  场景: Create returns trackable run
    - POST /v2/notebooks/:nid/research MUST 在合法 notebook 下创建 ResearchRun 并返回可追踪 id 与初始状态。

  @req:r302 @human
  场景: List and get runs for task inbox
    - 系统 MUST 提供 notebook 作用域的 listRuns 与 getRun；缺少 notebook 作用域时 MUST 拒绝全表列举。

  @req:r303 @human
  场景: Shared webSearch tool only
    - 深研 Runtime 的外网检索 MUST 复用既有 searchWeb/SearXNG 实现；MUST NOT 在 research 模块内复制第二套 SearXNG fetch。

  @req:r304 @human
  场景: H1 explicit source and web toggles
    - 创建 ResearchRun 时 MUST 接受显式 useNotebookSources 与 allowWeb；省略时默认 useNotebookSources=false、allowWeb=true（外网优先）；sourceIds MUST 仅表示深研配置台内选择、MUST NOT 隐式绑定工作区勾选状态；当 useNotebookSources 为 true 且 sourceIds 为空时 MUST 拒绝创建；当 useNotebookSources 与 allowWeb 皆为 false 时 MUST 拒绝创建；需要笔记本来源时客户端 MUST 显式传 useNotebookSources=true。

  @req:r305 @human
  场景: L1 depth tiers
    - 系统 MUST 支持浅/中/深三档深度并映射为 maxSearches 与 maxNodes；档位映射 MUST 可配置且默认值 MUST 来自 config schema（MUST NOT 硬编码于实现）；默认档 MUST 为中。

  @req:r306 @human
  场景: M1 confirm gates only
    - 待确认硬停 MUST 覆盖：外网搜索预算真触顶（searchesUsed≥maxSearches 且仍需花搜索）、主控扩展新支路、以及用户请求的 reexpand；budget 确认动作 MUST 为继续加购（抬高 maxSearches）或出报告；系统 MUST NOT 因波次结束仍有剩余搜索额度或逼近 maxSearches-1 而自动进入 confirmKind=budget；MUST NOT 恢复逐步审批计划或强制转化弹窗。

  @req:r307 @human
  场景: Convert to note is PARAGRAPH with footnotes
    - 显式 convertToNote MUST 将选定产物写入 Markdown PARAGRAPH Output；引用 MUST 按全局 citation map 序列化为 GFM 脚注形式；MUST NOT 在完成时自动写入笔记。

  @req:r308 @human
  场景: Convert to source is retrievable
    - 显式 convertToSource MUST 将来源入库并进入可嵌入索引路径，使得后续对话检索能够命中转化内容。

  @req:r309 @human
  场景: Report uses structured citations
    - Run 权威报告 MUST 为 LLM 结构化成稿（同形 ResearchReport：正文 sections + 全局 citation map）；citation map 可复用 Citation 字段；交互预览以该 SSOT 为准，笔记导出仅为投影；MUST NOT 以启发式证据清单冒充成功成稿。

  @req:r310 @human
  场景: Interactive prune and fork on live runs
    - 在 running 或 awaiting_confirm 状态时系统 MUST 支持对研究图节点的剪枝与 fork；剪枝语义 MUST 遵循 r316（排他父闭包、禁 sink、保留失败 merge）；fork MUST 与 M1 扩展支路共用能力面；completed/failed/cancelled 时图 MUST 只读且 MUST NOT 在同一 Run 上继续扩展（改方向须新 Run，除非后续 P2 明确允许从节点 fork 新 Run）。

  @req:r311 @human
  场景: R2a status machine and R3b SSE
    - ResearchRun MUST 使用状态 queued|running|awaiting_confirm|completed|failed|cancelled；GET stream MUST 发出 status、graph_patch、confirm、report_ready、log、error、progress 事件（R3b）；MUST NOT 对流式推送报告正文 token。

  @req:r312 @human
  场景: Cancel A1 and checkpoint CP1
    - 系统 MUST 提供协作 cancel：尽量落盘 checkpoint 并将状态置为 cancelled；checkpoint MUST 在每完成一图节点以及进入 awaiting_confirm 前强制落盘（CP1）。

  @req:r313 @human
  场景: EV1 run-scoped evidence store
    - 系统 MUST 为每个 ResearchRun 维护作用域内证据库（web 与 chunk 统一为 evidence 行并暴露稳定 id）；convert 目标 kind=evidence 时 MUST 引用该库；MUST NOT 仅用不稳定 URL hash 冒充首发 evidenceId SSOT。

  @req:r314 @human
  场景: ERR-G1 AppHttpError codes
    - 深研 HTTP 错误 MUST 走 AppHttpError/ErrorEnvelope；除既有通用 ErrorCode 外 MUST 仅新增 RESEARCH_INVALID_STATE 与 RESEARCH_BUDGET；MUST NOT 另建一整套 research-only error 命名空间。

  @req:r315 @human
  场景: D1 graph_patch and node edge fields
    - SSE graph_patch MUST 以增量 upsert nodes/edges 与 removeNodeIds/removeEdgeIds 表达；节点 MUST 携带 conclusionStatus（clear|partial|missing|pending|pruned）与可选 phase；边 MUST 使用闭集 EdgeKind（R5）并可带可选 labelNote。

  @req:r316 @human
  场景: Prune closure exclusive-parent B
    - 剪枝 MUST 计算排他父闭包：从目标研究节点出发仅沿非 merge 边向下扩展；子节点仅当其全部非保护入边父节点已在闭包内或已为 pruned 时方可纳入；闭包 MUST NOT 包含 root/question/conclusion（或 id 前缀 node_root_/node_conclusion_）；MUST NOT 沿 merge 边级联；对保护节点的 prune 请求 MUST 拒绝（INVALID_REQUEST 或等价）；被纳入闭包的节点 MUST 标记 conclusionStatus=pruned，且其既有 merge 入结论边 MUST 保留（失败汇入），MUST NOT 仅因剪枝删除该 merge。

  @req:r317 @human
  场景: Single-sink DAG with node role
    - ResearchRun 图 MUST 维护单一 question 与单一 conclusion（role 或兼容 id 前缀）；研究支路 MUST 经非 merge 边扩展，并对结论使用 merge 边汇入；系统 MUST NOT 在同一 Run 内创建第二个 conclusion sink；新写入节点 SHOULD 携带 role（question|research|conclusion），读取时语义以 role 为准并兼容历史 node_root_/node_conclusion_ 前缀。

  @req:r318 @human
  场景: Serial work-unit kernel CP1 and abort
    - 深研编排 MUST 以 ResearchRun 上的 work-unit 内核推进——单元级串行或受配置约束的有界并行（并行度上限与同 Run 模型调用串行化分别见 r327/r336）（种子图、节点检索/综合、结案出报告）；每完成一单元以及进入 awaiting_confirm 前 MUST 落盘 checkpoint（CP1）；开始单元前 MUST 重读图并跳过 conclusionStatus=pruned 的节点（discard-if-pruned）；cancel 与剪除当前活动节点时 MUST 中止进行中的单元（AbortSignal 或等价）并保持图 SSOT 在服务端；若存在进行中的节点 chat MUST 一并中止。

  @req:r319 @human
  场景: Fork approve merges into conclusion
    - 当 confirmKind=expand_branch 且用户 approve_branch 时，系统 MUST 新增 research 角色节点，MUST 建立从父节点出发的 fork 或 expand 边，并 MUST 建立该节点到唯一 conclusion 的 merge 边；MUST NOT 仅添加无汇入结论的线性子节点作为唯一结果；skip_branch MUST 不新增节点并允许内核继续。

  @req:r320 @human
  场景: Command-port mutations only
    - 研究图的权威突变 MUST 仅通过服务端命令口完成（create/confirm/cancel/prune/fork/节点 PATCH/revisions 恢复）；系统 MUST NOT 提供客户端整图上传作为 SSOT；剪枝闭包与拓扑约束 MUST 在服务端计算与强制；节点 chat MUST NOT 在未确认的情况下直接改图。

  @req:r321 @human
  场景: PATCH node fields on live runs
    - 在 running 或 awaiting_confirm 时系统 MUST 支持 PATCH 节点的 title、query、conclusionStatus（请求体至少一项）；对已 pruned 或受保护的 question/conclusion 节点 MUST 拒绝；完成后 MUST 经 graph_patch 或返回 Run 反映权威状态。

  @req:r322 @human
  场景: Node chat SSE proposals only
    - 系统 MUST 提供 POST 节点 chat 的短轮 SSE（正文增量与可选 ActionProposal/tool-approval）；chat MUST 与 Run 进度 stream 分离；同一 Run 上 chat 与自研 work-unit MUST 互斥（拒绝或排队）；Structure 类意图 MUST 经用户确认后调用既有命令口，MUST NOT 在 tool execute 中静默改图。

  @req:r323 @human
  场景: User-visible run revisions
    - 系统 MUST 为 ResearchRun 提供用户可见的 revisions：至少支持列表、从当前 graph 与权威 report 创建快照、按 id 读取；恢复某 revision MUST 将对应 graph/report 写回为当前权威并通知客户端（graph_patch 或等价）；revisions MUST NOT 与内部 checkpoint 混为同一概念。

  @req:r324 @human
  场景: Align ResearchRun contract to Lab design
    - 系统 MUST 使命令口合约与 Lab 设计语义一致（ResearchRun Zod 与 HTTP/SSE 行为同步）；server research 测试套件 MUST 全绿；MUST NOT 删除 /v2/notebooks/:nid/research* 主路由面。

  @req:r325 @human
  场景: Lab-only extras stay documented not silent
    - 未通过 API 暴露的研究能力，系统 MUST 在合约或能力清单中显式记录为非 API 权威，MUST NOT 用未文档化的占位响应或静默丢字段冒充已支持。

  @req:r326 @human
  场景: Topic auto-decompose after seed
    - seed 单结论 DAG 完成后，系统 MUST 通过结构化 LLM 规划将主题自动拆解为 research 角色节点：自 question 以 decompose/refine 边扩展，各活研究节点 MUST 以 merge 边汇入唯一 conclusion；节点总数 MUST 受 Run.maxNodes（depth→r305）约束；规划失败或输出非法时 MUST 回退为仅 question work-unit 路径且 MUST NOT 伪造多支路拓扑；拓扑权威 MUST 来自服务端 graph_patch 与 progress ledger，MUST NOT 以前端 timer/phase 为 SSOT；LLM MUST NOT 直接 mutate 图，仅允许经内核规划写回后 emit graph_patch。

  @req:r327 @human
  场景: Parallel-capable branch work-units
    - 系统 MUST 对图中全部非 pruned 的 research 角色节点执行 work-unit（检索/综合、节点工作写回、graph_patch）；调度 MUST 跳过 conclusionStatus=pruned 节点；完成分支波次后若搜索预算未触顶 MUST 直接 synthesize 收束（或按其它非 budget 门控继续，与 r306 的确认门控一致）；MUST NOT 为收束便利删除 research→conclusion 的 merge 边；每单元 MUST 写入 progress ledger（unit_started/unit_finished/unit_skipped_pruned）。调度 MAY 同时推进最多 N 个节点（N 由配置 parallelBranchUnits 给出，N=1 时等价串行）；同一 ResearchRun 上的 LLM 调用 MUST 串行（每 Run 至多一个进行中的 LLM）。

  @req:r328 @human
  场景: LLM synthesize report no heuristic success
    - 结案 MUST 经结构化 LLM 产出 ResearchReport 并在成功时将 Run 置为 completed；当结案模型调用失败或 cite 校验判定 synthesize_failed 时 MUST 将 Run 置为 failed 并暴露 failureReason；MUST NOT 在成功路径使用启发式证据清单作为权威报告；报告正文 token MUST NOT 进入 Run SSE（仍仅 report_ready + GET）。

  @req:r329 @human
  场景: Retry synthesize with optional modelId
    - 系统 MUST 提供对结案失败 Run 的 retry-synthesize 命令口（POST …/research/:rid/retry-synthesize 或等价）；请求 MAY 含 modelId 并 MUST 写回 Run；重试 MUST 复用已有 graph 与 evidence 且 MUST NOT 重跑 decompose 或支路 work-unit；成功 MUST completed+report，再次失败 MUST 保持 failed；对非结案失败态 MUST 拒绝（RESEARCH_INVALID_STATE 或等价）。

  @req:r330 @human
  场景: Run modelId on create and synthesize
    - 创建 ResearchRun 时 MUST 接受可选 modelId 并持久化；结案与 retry-synthesize MUST 使用 Run.modelId（省略时回落默认 chat/config）；retry 覆盖的 modelId MUST 写回 Run；GET Run MUST 暴露 modelId（若有）。

  @req:r331 @human
  场景: Citation bind sufficient not necessary
    - 结案 cite key MUST 绑定本 Run 证据映射；非法/悬空 key MUST 剥离；若模型声称引用且有效 cite 为零（全非法）则 MUST synthesize_failed；有证据却 0 cite、以及 0 证据下的诚实成稿 MUST 允许 completed；引用 MUST NOT 被当作节点或报告结论的必要条件。

  @req:r332 @human
  场景: Node short synthesis no fake hits
    - 支路 work-unit MUST 在检索后经 LLM 短综合写回节点摘要；空证据列表 MUST 合法；MUST NOT 使用 pragmatic 假命中回退冒充检索结果；当节点模型彻底失败无法产出结论时 MUST 标记该节点 conclusionStatus=missing（或等价）并继续其它支路，MUST NOT 仅因此将整 Run 立即 failed。

  @req:r333 @human
  场景: No automatic secondary decompose
    - 在无用户显式请求或 confirm 批准的情况下，内核 MUST NOT 在同一 ResearchRun 上自动执行第二次 topic decompose；首次 seed 后拆解（r326）不受本条禁止。

  @req:r334 @human
  场景: Confirm-gated request-reexpand
    - 系统 MUST 提供 request-reexpand 命令口（POST …/request-reexpand 或等价），使 Run 进入 awaiting_confirm 且 confirmKind=reexpand；用户 approve_reexpand MUST 经结构化规划追加 research 节点（受 maxNodes）并 graph_patch，skip_reexpand MUST 不新增支路并允许继续收束；规划失败 MUST NOT 伪造多支路；MUST NOT 在 tool execute 中静默改图。

  @req:r335 @human
  场景: Revision fork creates new Run
    - 系统 MUST 提供从某 revision 派生新 ResearchRun 的命令口（POST …/revisions/:revId/fork-run 或等价）；新 Run MUST 拷贝该 revision 快照的 graph 与 report（若有）以及源 Run 的 topic/预算/modelId 等创建配置，searchesUsed MUST 重置为 0 且初始 status MUST 为 queued；源 Run 的图/报告/revisions MUST 保持不变；默认 MUST NOT 自动 schedule；可选 schedule 或独立 schedule 口 MAY 仅对 queued Run 启动内核；图中 evidence 引用 MUST 在新 Run 作用域内可用（拷贝并 remap 或等价）。

  @req:r336 @human
  场景: Per-run LLM queue and write lock
    - 当 parallelBranchUnits>1 时，同一 ResearchRun 上并发的支路 work-unit MUST 经 per-Run LLM 队列串行化模型调用，并 MUST 对 persistGraph/evidence/writeBack 使用 per-Run 写锁；不同 Run 之间 MUST NOT 因此互斥；cancel/prune MUST 仍能中止进行中的单元；节点 chat 与 work-unit 互斥 MUST 保留。

  @req:r337 @human
  场景: fetchPage reuses extractor fallback chain
    - 当 allowWeb 为 true 时，研究节点的 work_unit 与 node_chat MUST 暴露 fetchPage（或等价）Work 工具以读取给定 URL 正文；实现 MUST 复用既有网页抽取回退链（readability→jina→firecrawl 或配置顺序）；MUST NOT 在 research 模块内另写第二套网页爬虫；单页抽取失败 MUST 保留已有 SERP 证据并允许单元继续，MUST NOT 仅因此将整 work-unit 或整 Run 立即 failed。

  @req:r338 @human
  场景: Page fetch budget independent of searches
    - 创建 ResearchRun 时 MUST 计算并持久化 maxPageFetches=max(1,ceil(maxSearches×pageRatio))（pageRatio 来自 config schema，实现 MUST NOT 写死默认值）且 pagesUsed 初始为 0；成功读页 MUST 递增 pagesUsed；每个 work-unit 开始时 MUST 计算每节点读页软上限 max(1,ceil(remainingPages/remainingLiveResearchNodes)) 并强制遵守；读页触顶 MUST NOT 进入 confirmKind=budget，MUST NOT 消耗 maxSearches；fork-run 时 pagesUsed MUST 重置为 0 并拷贝或按公式重算 maxPageFetches。

  @req:r339 @human
  场景: Evidence content token upgrade
    - web 证据在 fetchPage 成功后 MUST 在同 URL 证据上行写入截断正文 content 并保留原 snippet；节点内 web content 合计 MUST 受 nodeContentTokenBudget 约束（上限来自 config schema，使用项目既有 tokenizer）；短综合喂给模型的证据上下文 MUST 受 nodeSummaryTokenBudget 约束（上限同样来自 config schema）；短综合 MUST 能区分仅有 snippet 与已有 content；超限时 MUST 截断本页 content 而非丢弃 SERP 命中。

  @req:r340 @human
  场景: Agent-chosen page reads thin sufficiency
    - work_unit 工具环 MUST 由 agent 自选值得阅读的 URL 调用 fetchPage，MUST NOT 在运行时对每次 webSearch 结果自动读取 Top-N；工具环步数 MUST 取配置 workUnitMaxSteps；指令 MUST 向 agent 暴露剩余读页预算与本节点软上限，并要求在已读正文基础上薄判断是否足够再决定是否继续检索。

  @req:r341 @human
  场景: Search budget add-on formula
    - 当 confirmKind=budget 且用户选择 continue、或经加购命令口主动加购时，系统 MUST 将 maxSearches 增加 K，其中 K=clamp(ceil(当前 maxSearches×addOnRatio),minK,maxK)（addOnRatio/minK/maxK 来自 config schema，实现 MUST NOT 写死数值）；MUST NOT 在业务代码写死绝对加购块；加购 MUST NOT 抬高 maxNodes；budget continue 之后 MUST resume 研究内核而非立即强制结案。

  @req:r342 @human
  场景: Per-node search soft cap
    - 每个 research work-unit 开始时 MUST 计算搜索软上限 max(1,ceil(remainingSearches/remainingLiveResearchNodes))；该单元内成功 webSearch 次数 MUST NOT 超过该软上限，且仍受 Run.maxSearches 硬顶约束；work_unit 指令 MUST 向 agent 暴露剩余全局搜索额度与本节点软上限。

  @req:r343 @human
  场景: Proactive add-budget command
    - 系统 MUST 提供与 budget continue 同语义的加购命令口（POST …/add-budget 或等价），使 running 或 awaiting_confirm(budget) 的 Run 可在未撞墙时按公式抬高 maxSearches；agent MAY 提议加购但 MUST 经用户确认后走该命令口；MUST NOT 静默在 tool execute 中改预算。

  @req:r344 @human
  场景: Partial completion honesty on budget finish
    - 当用户在搜索预算触顶后选择 finish_report（或等价出报告）且仍存在未完成/missing 的 research 节点时，权威报告 MUST 明示预算用尽与未覆盖主题（或部分完成），MUST NOT 将残缺研究包装为已完整覆盖；已有证据仍 MUST 正常综合。

  @req:r306 @human
  场景: no-mid-wave-budget-confirm
    - 若波次结束且 searchesUsed 大于 0 但小于 maxSearches，则不得因剩余搜索额度而进入 confirmKind=budget

  @req:r314 @human
  场景: invalid-state-code
    - 若 Run 已 completed，则对其调用 prune 必须返回 RESEARCH_INVALID_STATE 且图保持只读

  @req:r316 @human
  场景: shared-child-stays-live
    - 若 libs 与 perf 均指向共享子节点 stream 且 libs 另有 merge 到 conclusion，则对 libs 执行 prune 后：libs 必须标为 pruned；stream 因仍有活父 perf 必须保持未剪枝；conclusion 不得被剪枝；libs→conclusion 的 merge 边必须仍在

  @req:r316 @human
  场景: exclusive-child-cascades
    - 若 data 仅有独占子 minimize 且 minimize merge 到 conclusion，则对 data 执行 prune 后 data 与 minimize 必须均标为 pruned；minimize→conclusion 的 merge 边必须保留；conclusion 不得被剪枝

  @req:r316 @human
  场景: reject-protected-root
    - 若 Run 处于 running 且存在 node_root_* 节点，则对该 root 的 prune 请求必须被拒绝且图保持不变

  @req:r318 @human
  场景: cancel-aborts-active
    - 若某节点的检索或综合正在进行时用户调用 cancel，则活动单元必须中止、状态进入 cancelled（或协作收尾至 cancelled）且 checkpoint 已落盘

  @req:r320 @human
  场景: reject-client-authored-closure
    - 客户端以非命令口方式提交任意节点集合作为权威剪枝结果时，请求必须被拒绝（或该接口不存在），图必须仅能经 prune 等命令口变更

  @req:r322 @human
  场景: chat-separate-from-run-stream
    - 已订阅 Run stream 的客户端发起节点 chat 时，chat 正文事件必须不出现在 Run stream 的事件名集合中

  @req:r326 @human
  场景: max-nodes-respected
    - 若 planner 提议的支路会使节点数超过 Run.maxNodes 预算，则服务端必须裁剪或拒绝扩展，节点数不得超过预算

  @req:r327 @human
  场景: skip-question-when-branches
    - 若 Run 已拆解出活 research 节点，则运行循环调度必须跳过 question work-unit，且各 research 节点完成写回

  @req:r328 @human
  场景: synthesize-fail-no-heuristic
    - 若结案模型调用抛错，则 Run status 必须为 failed 且不得存在启发式权威报告

  @req:r329 @human
  场景: retry-does-not-rerun-drain
    - 对已因结案失败而 failed 且已有支路 evidence 的 Run 执行 retry-synthesize 时，必须复用原 evidence 且不得新增 research work-unit 检索进度

  @req:r329 @human
  场景: retry-rejects-completed
    - 若 Run 已 completed，则调用 retry-synthesize 必须返回 RESEARCH_INVALID_STATE 或等价错误

  @req:r335 @human
  场景: fork-leaves-source-unchanged
    - fork 完成后再次读取源 Run 及其 revisions 列表，其内容必须与 fork 前一致

  @req:r338 @human
  场景: page-soft-cap-per-node
    - 若剩余 6 次读页且有 3 个活 research 节点，则该节点 work-unit 开始时的读页软上限必须为 2

  @req:r341 @human
  场景: addon-does-not-raise-max-nodes
    - 当 budget 加购发生时，maxNodes 必须保持不变，不得随加购抬高

  @req:r342 @human
  场景: search-soft-cap-even-split
    - 若剩余 9 次搜索且有 3 个活 research 节点，则该节点 work-unit 开始时的搜索软上限必须为 3，且仍受 Run.maxSearches 硬顶约束
