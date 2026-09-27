# language: zh-CN
# capability: deep-research-runtime
# purpose: ResearchRun HTTP/SSE 运行时：创建/列表/图命令口/报告/revisions 与编排约束（省略字段时外网优先默认）
# scope: apps/server/src/features/research/, packages/shared/src/schemas/

功能: deep-research-runtime

  @req:r53
  规则: ResearchRun is process SSOT
    系统 MUST 以 notebook 作用域的 ResearchRun 作为深研过程 SSOT（图、checkpoint、权威报告与 citation map 挂在 Run 上）；MUST NOT 把长跑过程态的唯一权威塞进 Output 行。
  @req:r54
  规则: Create returns trackable run
    POST /v2/notebooks/:nid/research MUST 在合法 notebook 下创建 ResearchRun 并返回可追踪 id 与初始状态。

    场景: create-run-returns-trackable-id
      假如 存在一个合法 notebook
      当 POST /v2/notebooks/:nid/research 创建 ResearchRun
      那么 响应返回可追踪的 run id 且初始状态为 queued
      而且 按 id GET 该 Run 能读取到同一研究对象
  @req:r55
  规则: List and get runs for task inbox
    系统 MUST 提供 notebook 作用域的 listRuns 与 getRun；缺少 notebook 作用域时 MUST 拒绝全表列举。

    场景: list-get-scoped-to-notebook
      假如 同一 notebook 下已创建多个 ResearchRun
      当 调用该 notebook 作用域的 listRuns 与 getRun
      那么 列表仅返回本 notebook 的 Run 且按 id 可读取详情
      而且 缺少 notebook 作用域的列举请求被拒绝而非返回全表
  @req:r56
  规则: Shared webSearch tool only
    深研 Runtime 的外网检索 MUST 复用既有 searchWeb/SearXNG 实现；MUST NOT 在 research 模块内复制第二套 SearXNG fetch。
  @req:r57
  规则: H1 explicit source and web toggles
    创建 ResearchRun 时 MUST 接受显式 useNotebookSources 与 allowWeb；省略时默认 useNotebookSources=false、allowWeb=true（外网优先）；sourceIds MUST 仅表示深研配置台内选择、MUST NOT 隐式绑定工作区勾选状态；当 useNotebookSources 为 true 且 sourceIds 为空时 MUST 拒绝创建；当 useNotebookSources 与 allowWeb 皆为 false 时 MUST 拒绝创建；需要笔记本来源时客户端 MUST 显式传 useNotebookSources=true。

    场景: source-web-toggle-defaults
      假如 客户端创建 ResearchRun 时省略 useNotebookSources 与 allowWeb
      当 服务端解析创建请求
      那么 默认取 useNotebookSources=false 且 allowWeb=true
      而且 useNotebookSources=true 且 sourceIds 为空、或两开关皆为 false 的创建请求均被拒绝
  @req:r58
  规则: L1 depth tiers
    系统 MUST 支持浅/中/深三档深度并映射为 maxSearches 与 maxNodes；档位映射 MUST 可配置且默认值 MUST 来自 config schema（MUST NOT 硬编码于实现）；默认档 MUST 为中。

    场景: depth-tier-maps-budget
      假如 创建 ResearchRun 时分别选择浅/中/深某一深度档
      当 服务端按 config schema 的档位映射计算预算
      那么 各档映射为对应 maxSearches 与 maxNodes 且默认档为中
      而且 调整 config 映射即可改变各档预算而无需改实现
  @req:r59
  规则: M1 confirm gates only
    待确认硬停 MUST 覆盖：外网搜索预算真触顶（searchesUsed≥maxSearches 且仍需花搜索）、主控扩展新支路、以及用户请求的 reexpand；budget 确认动作 MUST 为继续加购（抬高 maxSearches）或出报告；系统 MUST NOT 因波次结束仍有剩余搜索额度或逼近 maxSearches-1 而自动进入 confirmKind=budget；MUST NOT 恢复逐步审批计划或强制转化弹窗。

    场景: budget-confirm-only-on-real-cap
      假如 波次结束时 searchesUsed≥maxSearches 且仍需继续花搜索
      当 内核评估是否进入待确认硬停
      那么 Run 进入 awaiting_confirm 且 confirmKind=budget，确认动作仅限继续加购或出报告
      而且 仍有剩余搜索额度或仅逼近 maxSearches-1 时不得自动进入 budget 确认
  @req:r60
  规则: Convert to note is PARAGRAPH with footnotes
    显式 convertToNote MUST 将选定产物写入 Markdown PARAGRAPH Output；引用 MUST 按全局 citation map 序列化为 GFM 脚注形式；MUST NOT 在完成时自动写入笔记。

    场景: convert-note-gfm-footnotes
      假如 Run 已完成且全局 citation map 含多条引用
      当 用户显式调用 convertToNote 写入选定产物
      那么 生成 Markdown PARAGRAPH 类型的 Output
      而且 引用序列化为 GFM 脚注且 Run 完成时不会自动写入笔记
  @req:r61
  规则: Convert to source is retrievable
    显式 convertToSource MUST 将来源入库并进入可嵌入索引路径，使得后续对话检索能够命中转化内容。

    场景: convert-source-retrievable
      假如 某研究产物关联了一条来源内容
      当 用户显式调用 convertToSource 将其入库
      那么 该来源进入可嵌入索引路径
      而且 后续对话检索能命中该转化内容
  @req:r62
  规则: Report uses structured citations
    Run 权威报告 MUST 为 LLM 结构化成稿（同形 ResearchReport：正文 sections + 全局 citation map）；citation map 可复用 Citation 字段；交互预览以该 SSOT 为准，笔记导出仅为投影；MUST NOT 以启发式证据清单冒充成功成稿。

    场景: report-structured-with-citation-map
      假如 结案 synthesize 已成功
      当 读取该 Run 的权威报告与交互预览
      那么 报告为同形 ResearchReport（正文 sections + 全局 citation map）
      而且 交互预览以该 SSOT 为准且无启发式证据清单冒充的成功成稿
  @req:r63
  规则: Interactive prune and fork on live runs
    在 running 或 awaiting_confirm 状态时系统 MUST 支持对研究图节点的剪枝与 fork；剪枝语义 MUST 遵循 r69（排他父闭包、禁 sink、保留失败 merge）；fork MUST 与 M1 扩展支路共用能力面；completed/failed/cancelled 时图 MUST 只读且 MUST NOT 在同一 Run 上继续扩展（改方向须新 Run，除非后续 P2 明确允许从节点 fork 新 Run）。

    场景: prune-fork-allowed-while-live
      假如 Run 处于 running 或 awaiting_confirm 状态
      当 用户对某研究节点分别发起 prune 与 fork 命令
      那么 两类命令均被接受且剪枝遵循排他父闭包语义、fork 与 M1 扩展支路共用能力面
      而且 Run 进入 completed/failed/cancelled 后同一 Run 上的图只读且扩展被拒绝
  @req:r64
  规则: R2a status machine and R3b SSE
    ResearchRun MUST 使用状态 queued|running|awaiting_confirm|completed|failed|cancelled；GET stream MUST 发出 status、graph_patch、confirm、report_ready、log、error、progress 事件（R3b）；MUST NOT 对流式推送报告正文 token。

    场景: sse-emits-declared-events
      假如 客户端已订阅 GET Run stream 且 Run 开始推进
      当 Run 在 queued|running|awaiting_confirm|completed 状态集内迁移
      那么 stream 发出 status、graph_patch、progress、report_ready、log 等声明事件
      而且 流中不推送报告正文 token
  @req:r65
  规则: Cancel A1 and checkpoint CP1
    系统 MUST 提供协作 cancel：尽量落盘 checkpoint 并将状态置为 cancelled；checkpoint MUST 在每完成一图节点以及进入 awaiting_confirm 前强制落盘（CP1）。

    场景: cancel-persists-checkpoint
      假如 存在 running 状态且已完成若干图节点的 ResearchRun
      当 用户经命令口触发协作 cancel
      那么 状态变为 cancelled 且已落盘 checkpoint
      而且 每完成一图节点与进入 awaiting_confirm 前均强制落盘 checkpoint（CP1）
  @req:r66
  规则: EV1 run-scoped evidence store
    系统 MUST 为每个 ResearchRun 维护作用域内证据库（web 与 chunk 统一为 evidence 行并暴露稳定 id）；convert 目标 kind=evidence 时 MUST 引用该库；MUST NOT 仅用不稳定 URL hash 冒充首发 evidenceId SSOT。

    场景: evidence-store-scoped-with-ids
      假如 某研究节点同时完成了 web 检索与 notebook chunk 检索
      当 读取该 Run 作用域内的证据库
      那么 web 与 chunk 统一为 evidence 行且各自暴露稳定 id
      而且 convert 目标 kind=evidence 引用该库而非不稳定 URL hash
  @req:r67
  规则: ERR-G1 AppHttpError codes
    深研 HTTP 错误 MUST 走 AppHttpError/ErrorEnvelope；除既有通用 ErrorCode 外 MUST 仅新增 RESEARCH_INVALID_STATE 与 RESEARCH_BUDGET；MUST NOT 另建一整套 research-only error 命名空间。

    场景: research-errors-use-app-envelope
      假如 客户端对已 completed 的 Run 调用 prune 或触发搜索预算错误
      当 服务端返回深研相关错误
      那么 响应走 AppHttpError/ErrorEnvelope 且码为 RESEARCH_INVALID_STATE 或 RESEARCH_BUDGET
      而且 不存在另一套 research-only 错误命名空间
  @req:r68
  规则: D1 graph_patch and node edge fields
    SSE graph_patch MUST 以增量 upsert nodes/edges 与 removeNodeIds/removeEdgeIds 表达；节点 MUST 携带 conclusionStatus（clear|partial|missing|pending|pruned）与可选 phase；边 MUST 使用闭集 EdgeKind（R5）并可带可选 labelNote。

    场景: graph-patch-incremental-fields
      假如 内核新增一个节点与一条边并移除另一条边
      当 客户端收到对应的 graph_patch 事件
      那么 补丁以增量 upsert nodes/edges 与 removeNodeIds/removeEdgeIds 表达
      而且 节点携带 conclusionStatus 与可选 phase、边使用闭集 EdgeKind 并可带 labelNote
  @req:r69
  规则: Prune closure exclusive-parent B
    剪枝 MUST 计算排他父闭包：从目标研究节点出发仅沿非 merge 边向下扩展；子节点仅当其全部非保护入边父节点已在闭包内或已为 pruned 时方可纳入；闭包 MUST NOT 包含 root/question/conclusion（或 id 前缀 node_root_/node_conclusion_）；MUST NOT 沿 merge 边级联；对保护节点的 prune 请求 MUST 拒绝（INVALID_REQUEST 或等价）；被纳入闭包的节点 MUST 标记 conclusionStatus=pruned，且其既有 merge 入结论边 MUST 保留（失败汇入），MUST NOT 仅因剪枝删除该 merge。

    场景: prune-closure-excludes-protected
      假如 图中存在目标研究节点、其独占子节点与经 merge 边汇入的共享支路
      当 对该目标研究节点执行 prune
      那么 闭包仅沿非 merge 边向下计算且纳入节点标记 conclusionStatus=pruned
      而且 root/question/conclusion 不入闭包、不沿 merge 边级联且对保护节点的请求被拒绝
  @req:r70
  规则: Single-sink DAG with node role
    ResearchRun 图 MUST 维护单一 question 与单一 conclusion（role 或兼容 id 前缀）；研究支路 MUST 经非 merge 边扩展，并对结论使用 merge 边汇入；系统 MUST NOT 在同一 Run 内创建第二个 conclusion sink；新写入节点 SHOULD 携带 role（question|research|conclusion），读取时语义以 role 为准并兼容历史 node_root_/node_conclusion_ 前缀。

    场景: single-sink-dag-roles
      假如 内核在某 Run 内扩展支路并结案
      当 读取该 Run 的研究图
      那么 图中恰有单一 question 与单一 conclusion 且支路经非 merge 边扩展、结论经 merge 边汇入
      而且 新节点携带 role（question|research|conclusion）且不存在第二个 conclusion sink
  @req:r71
  规则: Serial work-unit kernel CP1 and abort
    深研编排 MUST 以 ResearchRun 上的 work-unit 内核推进——单元级串行或受配置约束的有界并行（并行度上限与同 Run 模型调用串行化分别见 r81/r90）（种子图、节点检索/综合、结案出报告）；每完成一单元以及进入 awaiting_confirm 前 MUST 落盘 checkpoint（CP1）；开始单元前 MUST 重读图并跳过 conclusionStatus=pruned 的节点（discard-if-pruned）；cancel 与剪除当前活动节点时 MUST 中止进行中的单元（AbortSignal 或等价）并保持图 SSOT 在服务端；若存在进行中的节点 chat MUST 一并中止。

    场景: kernel-rereads-graph-skips-pruned
      假如 某研究节点已被标记 conclusionStatus=pruned 且另一单元正在进行
      当 内核开始下一单元并随后收到 cancel
      那么 开始单元前重读图并跳过 pruned 节点（discard-if-pruned）
      而且 进行中单元与进行中的节点 chat 经 AbortSignal 中止且图 SSOT 保持在服务端
  @req:r72
  规则: Fork approve merges into conclusion
    当 confirmKind=expand_branch 且用户 approve_branch 时，系统 MUST 新增 research 角色节点，MUST 建立从父节点出发的 fork 或 expand 边，并 MUST 建立该节点到唯一 conclusion 的 merge 边；MUST NOT 仅添加无汇入结论的线性子节点作为唯一结果；skip_branch MUST 不新增节点并允许内核继续。

    场景: approve-branch-forks-and-merges
      假如 Run 处于 awaiting_confirm 且 confirmKind=expand_branch
      当 用户经命令口 approve_branch
      那么 新增 research 角色节点并建立父节点出发的 fork/expand 边与到唯一 conclusion 的 merge 边
      而且 skip_branch 不新增节点并允许内核继续
  @req:r73
  规则: Command-port mutations only
    研究图的权威突变 MUST 仅通过服务端命令口完成（create/confirm/cancel/prune/fork/节点 PATCH/revisions 恢复）；系统 MUST NOT 提供客户端整图上传作为 SSOT；剪枝闭包与拓扑约束 MUST 在服务端计算与强制；节点 chat MUST NOT 在未确认的情况下直接改图。

    场景: mutations-via-command-port
      假如 客户端尝试以非命令口方式上传整图或让节点 chat 直接改图
      当 请求到达服务端
      那么 权威突变仅经 create/confirm/cancel/prune/fork/PATCH/revisions 恢复等命令口完成
      而且 整图上传不被接受为 SSOT 且剪枝闭包与拓扑约束由服务端计算强制
  @req:r74
  规则: PATCH node fields on live runs
    在 running 或 awaiting_confirm 时系统 MUST 支持 PATCH 节点的 title、query、conclusionStatus（请求体至少一项）；对已 pruned 或受保护的 question/conclusion 节点 MUST 拒绝；完成后 MUST 经 graph_patch 或返回 Run 反映权威状态。

    场景: patch-node-rejects-pruned-protected
      假如 Run 处于 running 且存在普通研究节点、已 pruned 节点与 question/conclusion 节点
      当 对三类节点分别发起 PATCH（body 携带 title/query/conclusionStatus 至少一项）
      那么 普通节点更新成功且经 graph_patch 或返回 Run 反映权威状态
      而且 对已 pruned 节点与受保护 question/conclusion 节点的 PATCH 被拒绝
  @req:r75
  规则: Node chat SSE proposals only
    系统 MUST 提供 POST 节点 chat 的短轮 SSE（正文增量与可选 ActionProposal/tool-approval）；chat MUST 与 Run 进度 stream 分离；同一 Run 上 chat 与自研 work-unit MUST 互斥（拒绝或排队）；Structure 类意图 MUST 经用户确认后调用既有命令口，MUST NOT 在 tool execute 中静默改图。

    场景: node-chat-sse-proposal-flow
      假如 用户对某节点发起 POST chat 且会话返回 Structure 类 ActionProposal
      当 客户端消费该短轮 SSE 并确认提案
      那么 确认后经既有命令口执行变更而不在 tool execute 中静默改图
      而且 同一 Run 上 chat 与进行中 work-unit 互斥（拒绝或排队）且 chat 流与 Run 进度 stream 分离
  @req:r76
  规则: Node chat failure is honest
    模型调用失败（provider 错误、网关不可达、输出非法）时，系统 MUST 以 chat SSE 的 error 事件终结本轮对话（携带 errorCode 与用户可读 message），MUST NOT 以 stub、模板或占位正文冒充模型回复；progress ledger MUST 记录对应 chat 失败事件。stub 回复路径 MUST 仅在显式非生产开关（CL_RESEARCH_E2E_STUB=1）下可达，且该开关开启时 progress 事件 MUST 携带 via='stub' 标记。用户主动中止（abort）语义不变（error 事件 + chat_aborted 账本事件）。

    场景: chat-failure-emits-error-event
      假如 节点 chat 的模型调用因 provider 错误或输出非法而失败
      当 客户端消费本轮 chat SSE
      那么 收到携带 errorCode 与用户可读 message 的 error 事件并终结本轮对话
      而且 不出现 stub 或占位正文且 progress ledger 记录 chat 失败事件
  @req:r77
  规则: User-visible run revisions
    系统 MUST 为 ResearchRun 提供用户可见的 revisions：至少支持列表、从当前 graph 与权威 report 创建快照、按 id 读取；恢复某 revision MUST 将对应 graph/report 写回为当前权威并通知客户端（graph_patch 或等价）；revisions MUST NOT 与内部 checkpoint 混为同一概念。

    场景: revision-create-restore-notifies
      假如 Run 已有权威 graph 与 report
      当 用户创建 revision 快照并按 id 恢复该快照
      那么 列表与按 id 读取可见该快照且恢复后 graph/report 写回为当前权威
      而且 客户端收到 graph_patch 或等价通知且 revisions 不与内部 checkpoint 混同
  @req:r78
  规则: Align ResearchRun contract to Lab design
    系统 MUST 使命令口合约与 Lab 设计语义一致（ResearchRun Zod 与 HTTP/SSE 行为同步）；server research 测试套件 MUST 全绿；MUST NOT 删除 /v2/notebooks/:nid/research* 主路由面。
  @req:r79
  规则: Lab-only extras stay documented not silent
    未通过 API 暴露的研究能力，系统 MUST 在合约或能力清单中显式记录为非 API 权威，MUST NOT 用未文档化的占位响应或静默丢字段冒充已支持。
  @req:r80
  规则: Topic auto-decompose after seed
    seed 单结论 DAG 完成后，系统 MUST 通过结构化 LLM 规划将主题自动拆解为 research 角色节点：自 question 以 decompose/refine 边扩展，各活研究节点 MUST 以 merge 边汇入唯一 conclusion；节点总数 MUST 受 Run.maxNodes（depth→r58）约束；规划失败或输出非法时 MUST 回退为仅 question work-unit 路径且 MUST NOT 伪造多支路拓扑；拓扑权威 MUST 来自服务端 graph_patch 与 progress ledger，MUST NOT 以前端 timer/phase 为 SSOT；LLM MUST NOT 直接 mutate 图，仅允许经内核规划写回后 emit graph_patch。

    场景: seed-decompose-merges-to-conclusion
      假如 seed 单结论 DAG 已完成且结构化 LLM 规划输出合法拆解
      当 内核写回规划结果
      那么 question 自 decompose/refine 边扩展出 research 节点且各活节点以 merge 边汇入唯一 conclusion
      而且 节点总数受 Run.maxNodes 约束且规划失败时回退为仅 question work-unit 路径
  @req:r81
  规则: Parallel-capable branch work-units
    系统 MUST 对图中全部非 pruned 的 research 角色节点执行 work-unit（检索/综合、节点工作写回、graph_patch）；调度 MUST 跳过 conclusionStatus=pruned 节点；完成分支波次后若搜索预算未触顶 MUST 直接 synthesize 收束（或按其它非 budget 门控继续，与 r59 的确认门控一致）；MUST NOT 为收束便利删除 research→conclusion 的 merge 边；每单元 MUST 写入 progress ledger（unit_started/unit_finished/unit_skipped_pruned）。调度 MAY 同时推进最多 N 个节点（N 由配置 parallelBranchUnits 给出，N=1 时等价串行）；同一 ResearchRun 上的 LLM 调用 MUST 串行（每 Run 至多一个进行中的 LLM）。

    场景: branch-units-drain-with-ledger
      假如 图中存在多个非 pruned 的 research 角色节点
      当 分支波次调度执行各节点 work-unit 并全部完成
      那么 每节点经检索/综合写回并 emit graph_patch 且 progress ledger 记录 unit_started/unit_finished
      而且 pruned 节点记 unit_skipped_pruned 且波次后预算未触顶直接 synthesize 收束、research→conclusion 的 merge 边不被删除
  @req:r82
  规则: LLM synthesize report no heuristic success
    结案 MUST 经结构化 LLM 产出 ResearchReport 并在成功时将 Run 置为 completed；当结案模型调用失败或 cite 校验判定 synthesize_failed 时 MUST 将 Run 置为 failed 并暴露 failureReason；MUST NOT 在成功路径使用启发式证据清单作为权威报告；报告正文 token MUST NOT 进入 Run SSE（仍仅 report_ready + GET）。

    场景: synthesize-success-completes-run
      假如 各支路收束且结案结构化 LLM 调用成功
      当 读取 Run 状态与权威报告
      那么 Run 置为 completed 且权威报告为结构化 ResearchReport
      而且 报告正文 token 仅经 GET 获取而不进入 Run SSE
  @req:r83
  规则: Retry synthesize with optional modelId
    系统 MUST 提供对结案失败 Run 的 retry-synthesize 命令口（POST …/research/:rid/retry-synthesize 或等价）；请求 MAY 含 modelId 并 MUST 写回 Run；重试 MUST 复用已有 graph 与 evidence 且 MUST NOT 重跑 decompose 或支路 work-unit；成功 MUST completed+report，再次失败 MUST 保持 failed；对非结案失败态 MUST 拒绝（RESEARCH_INVALID_STATE 或等价）。

    场景: retry-synthesize-reuses-graph
      假如 存在因结案失败而 failed 的 ResearchRun
      当 经 POST retry-synthesize 命令口重试（可携带 modelId）
      那么 重试复用已有 graph 与 evidence 且不重跑 decompose 或支路 work-unit
      而且 成功置 completed+report、再次失败保持 failed、非结案失败态被拒绝
  @req:r84
  规则: Run modelId on create and synthesize
    创建 ResearchRun 时 MUST 接受可选 modelId 并持久化；结案与 retry-synthesize MUST 使用 Run.modelId（省略时回落默认 chat/config）；retry 覆盖的 modelId MUST 写回 Run；GET Run MUST 暴露 modelId（若有）。

    场景: modelid-persisted-and-overridden
      假如 创建 Run 时传入可选 modelId 且后续 retry-synthesize 传入另一 modelId
      当 分别读取创建结果与重试后的 Run
      那么 创建的 modelId 已持久化且 retry 覆盖的 modelId 写回 Run
      而且 结案使用 Run.modelId（省略时回落默认）且 GET Run 暴露该 modelId
  @req:r85
  规则: Citation bind sufficient not necessary
    结案 cite key MUST 绑定本 Run 证据映射；非法/悬空 key MUST 剥离；若模型声称引用且有效 cite 为零（全非法）则 MUST synthesize_failed；有证据却 0 cite、以及 0 证据下的诚实成稿 MUST 允许 completed；引用 MUST NOT 被当作节点或报告结论的必要条件。

    场景: invalid-cite-keys-stripped
      假如 结案模型输出中混有有效 cite key 与悬空 key
      当 validateAndBindCitations 处理报告
      那么 悬空 key 被剥离且有效 cite 绑定本 Run 证据映射
      而且 声称引用但有效 cite 为零时 synthesize_failed、有证据却 0 cite 或 0 证据诚实成稿仍可 completed
  @req:r86
  规则: Node short synthesis no fake hits
    支路 work-unit MUST 在检索后经 LLM 短综合写回节点摘要；空证据列表 MUST 合法；MUST NOT 使用 pragmatic 假命中回退冒充检索结果；当节点模型彻底失败无法产出结论时 MUST 标记该节点 conclusionStatus=missing（或等价）并继续其它支路，MUST NOT 仅因此将整 Run 立即 failed。

    场景: node-missing-continues-run
      假如 某支路检索返回空证据且另一节点模型彻底失败
      当 各 work-unit 执行 LLM 短综合写回
      那么 空证据列表合法且摘要正常写回且不出现 pragmatic 假命中
      而且 彻底失败的节点标记 conclusionStatus=missing 且其余支路继续、整 Run 不因此立即 failed
  @req:r87
  规则: No automatic secondary decompose
    在无用户显式请求或 confirm 批准的情况下，内核 MUST NOT 在同一 ResearchRun 上自动执行第二次 topic decompose；首次 seed 后拆解（r80）不受本条禁止。

    场景: no-auto-second-decompose
      假如 Run 已完成首次 seed 后拆解且无用户显式请求或 confirm 批准
      当 内核继续推进后续波次
      那么 不在同一 Run 上自动执行第二次 topic decompose
      而且 研究节点集合不因自动拆解而扩大
  @req:r88
  规则: Confirm-gated request-reexpand
    系统 MUST 提供 request-reexpand 命令口（POST …/request-reexpand 或等价），使 Run 进入 awaiting_confirm 且 confirmKind=reexpand；用户 approve_reexpand MUST 经结构化规划追加 research 节点（受 maxNodes）并 graph_patch，skip_reexpand MUST 不新增支路并允许继续收束；规划失败 MUST NOT 伪造多支路；MUST NOT 在 tool execute 中静默改图。

    场景: reexpand-approve-adds-branches
      假如 用户对 running 的 Run 调用 request-reexpand 命令口
      当 Run 进入 awaiting_confirm 且 confirmKind=reexpand 后用户 approve_reexpand
      那么 经结构化规划追加受 maxNodes 约束的 research 节点并 emit graph_patch
      而且 skip_reexpand 不新增支路并继续收束、规划失败不伪造多支路
  @req:r89
  规则: Revision fork creates new Run
    系统 MUST 提供从某 revision 派生新 ResearchRun 的命令口（POST …/revisions/:revId/fork-run 或等价）；新 Run MUST 拷贝该 revision 快照的 graph 与 report（若有）以及源 Run 的 topic/预算/modelId 等创建配置，searchesUsed MUST 重置为 0 且初始 status MUST 为 queued；源 Run 的图/报告/revisions MUST 保持不变；默认 MUST NOT 自动 schedule；可选 schedule 或独立 schedule 口 MAY 仅对 queued Run 启动内核；图中 evidence 引用 MUST 在新 Run 作用域内可用（拷贝并 remap 或等价）。

    场景: fork-run-resets-budget-queued
      假如 源 Run 存在一条 revision 快照
      当 经 POST revisions/:revId/fork-run 派生新 Run
      那么 新 Run 拷贝快照 graph/report 与源 Run 创建配置且 status 为 queued、searchesUsed 重置为 0
      而且 evidence 引用在新 Run 作用域内可用且默认不自动 schedule
  @req:r90
  规则: Per-run LLM queue and write lock
    当 parallelBranchUnits>1 时，同一 ResearchRun 上并发的支路 work-unit MUST 经 per-Run LLM 队列串行化模型调用，并 MUST 对 persistGraph/evidence/writeBack 使用 per-Run 写锁；不同 Run 之间 MUST NOT 因此互斥；cancel/prune MUST 仍能中止进行中的单元；节点 chat 与 work-unit 互斥 MUST 保留。

    场景: per-run-llm-serialized
      假如 parallelBranchUnits>1 且同一 Run 有多个并发支路 work-unit
      当 各单元调用 LLM 并写回图
      那么 模型调用经 per-Run LLM 队列串行且 persistGraph/evidence/writeBack 持 per-Run 写锁
      而且 不同 Run 互不阻塞且 cancel/prune 可中止单元、chat 与 work-unit 互斥保留
  @req:r91
  规则: fetchPage reuses extractor fallback chain
    当 allowWeb 为 true 时，研究节点的 work_unit 与 node_chat MUST 暴露 fetchPage（或等价）Work 工具以读取给定 URL 正文；实现 MUST 复用既有网页抽取回退链（readability→jina→firecrawl 或配置顺序）；MUST NOT 在 research 模块内另写第二套网页爬虫；单页抽取失败 MUST 保留已有 SERP 证据并允许单元继续，MUST NOT 仅因此将整 work-unit 或整 Run 立即 failed。

    场景: fetchpage-reuses-extractor-chain
      假如 allowWeb=true 且 work_unit 内 agent 调用 fetchPage 读取某 URL
      当 页面抽取执行
      那么 复用既有 readability→jina→firecrawl 回退链而非 research 模块内新写的爬虫
      而且 单页抽取失败时保留已有 SERP 证据且单元与整 Run 不因此立即 failed
  @req:r92
  规则: Page fetch budget independent of searches
    创建 ResearchRun 时 MUST 计算并持久化 maxPageFetches=max(1,ceil(maxSearches×pageRatio))（pageRatio 来自 config schema，实现 MUST NOT 写死默认值）且 pagesUsed 初始为 0；成功读页 MUST 递增 pagesUsed；每个 work-unit 开始时 MUST 计算每节点读页软上限 max(1,ceil(remainingPages/remainingLiveResearchNodes)) 并强制遵守；读页触顶 MUST NOT 进入 confirmKind=budget，MUST NOT 消耗 maxSearches；fork-run 时 pagesUsed MUST 重置为 0 并拷贝或按公式重算 maxPageFetches。

    场景: max-page-fetches-formula
      假如 创建 Run 时的 maxSearches 与 config 的 pageRatio 已确定
      当 服务端初始化并推进读页预算
      那么 maxPageFetches=max(1,ceil(maxSearches×pageRatio)) 且 pagesUsed 初始为 0、成功读页递增
      而且 每单元开始计算每节点读页软上限且读页触顶不进入 confirmKind=budget、不消耗 maxSearches
  @req:r93
  规则: Evidence content token upgrade
    web 证据在 fetchPage 成功后 MUST 在同 URL 证据上行写入截断正文 content 并保留原 snippet；节点内 web content 合计 MUST 受 nodeContentTokenBudget 约束（上限来自 config schema，使用项目既有 tokenizer）；短综合喂给模型的证据上下文 MUST 受 nodeSummaryTokenBudget 约束（上限同样来自 config schema）；短综合 MUST 能区分仅有 snippet 与已有 content；超限时 MUST 截断本页 content 而非丢弃 SERP 命中。

    场景: fetchpage-upgrades-content-token-bounded
      假如 某条 web 证据仅有 snippet 且对应 URL fetchPage 成功
      当 证据行升级并执行节点短综合
      那么 同 URL 证据行写入截断正文 content 且原 snippet 保留
      而且 content 合计受 nodeContentTokenBudget、喂模上下文受 nodeSummaryTokenBudget 约束且超限截断本页 content 而非丢弃 SERP 命中
  @req:r94
  规则: Agent-chosen page reads thin sufficiency
    work_unit 工具环 MUST 由 agent 自选值得阅读的 URL 调用 fetchPage，MUST NOT 在运行时对每次 webSearch 结果自动读取 Top-N；工具环步数 MUST 取配置 workUnitMaxSteps；指令 MUST 向 agent 暴露剩余读页预算与本节点软上限，并要求在已读正文基础上薄判断是否足够再决定是否继续检索。
  @req:r95
  规则: Search budget add-on formula
    当 confirmKind=budget 且用户选择 continue、或经加购命令口主动加购时，系统 MUST 将 maxSearches 增加 K，其中 K=clamp(ceil(当前 maxSearches×addOnRatio),minK,maxK)（addOnRatio/minK/maxK 来自 config schema，实现 MUST NOT 写死数值）；MUST NOT 在业务代码写死绝对加购块；加购 MUST NOT 抬高 maxNodes；budget continue 之后 MUST resume 研究内核而非立即强制结案。

    场景: addon-formula-clamped
      假如 confirmKind=budget 且用户选择 continue 或经加购命令口主动加购
      当 服务端计算加购量并写回 Run
      那么 maxSearches 增加 K=clamp(ceil(当前 maxSearches×addOnRatio),minK,maxK)
      而且 参数取自 config schema、maxNodes 不被抬高且 continue 后 resume 研究内核
  @req:r96
  规则: Per-node search soft cap
    每个 research work-unit 开始时 MUST 计算搜索软上限 max(1,ceil(remainingSearches/remainingLiveResearchNodes))；该单元内成功 webSearch 次数 MUST NOT 超过该软上限，且仍受 Run.maxSearches 硬顶约束；work_unit 指令 MUST 向 agent 暴露剩余全局搜索额度与本节点软上限。

    场景: search-soft-cap-computed
      假如 Run 的剩余搜索额度与活 research 节点数已确定
      当 某 research work-unit 开始
      那么 软上限取 max(1,ceil(remainingSearches/remainingLiveResearchNodes)) 且指令向 agent 暴露剩余额度与软上限
      而且 单元内成功 webSearch 不超软上限且仍受 Run.maxSearches 硬顶约束
  @req:r97
  规则: Proactive add-budget command
    系统 MUST 提供与 budget continue 同语义的加购命令口（POST …/add-budget 或等价），使 running 或 awaiting_confirm(budget) 的 Run 可在未撞墙时按公式抬高 maxSearches；agent MAY 提议加购但 MUST 经用户确认后走该命令口；MUST NOT 静默在 tool execute 中改预算。

    场景: add-budget-command-raises-cap
      假如 Run 处于 running 或 awaiting_confirm(budget) 且尚未撞搜索墙
      当 用户经 POST add-budget 命令口主动加购
      那么 maxSearches 按公式抬高且语义与 budget continue 一致
      而且 agent 仅可提议加购、经用户确认走命令口且不在 tool execute 中静默改预算
  @req:r98
  规则: Partial completion honesty on budget finish
    当用户在搜索预算触顶后选择 finish_report（或等价出报告）且仍存在未完成/missing 的 research 节点时，权威报告 MUST 明示预算用尽与未覆盖主题（或部分完成），MUST NOT 将残缺研究包装为已完整覆盖；已有证据仍 MUST 正常综合。

    场景: finish-report-discloses-uncovered
      假如 搜索预算触顶且仍存在未完成/missing 的 research 节点
      当 用户选择 finish_report 出报告
      那么 权威报告明示预算用尽与未覆盖主题（部分完成）
      而且 已有证据仍被正常综合且残缺研究不被包装为已完整覆盖
  @req:r425

  规则: no-mid-wave-budget-confirm
    若波次结束且 searchesUsed 大于 0 但小于 maxSearches，则不得因剩余搜索额度而进入 confirmKind=budget

    场景: no-budget-confirm-with-remaining-searches
      假如 波次结束且 searchesUsed 大于 0 但小于 maxSearches
      当 内核评估波次收尾
      那么 不进入 confirmKind=budget
      而且 后续走向按其它门控判断而非由剩余额度触发确认
  @req:r426

  规则: invalid-state-code
    若 Run 已 completed，则对其调用 prune 必须返回 RESEARCH_INVALID_STATE 且图保持只读

    场景: prune-completed-run-invalid-state
      假如 某 ResearchRun 已 completed
      当 对其图中节点调用 prune
      那么 返回 RESEARCH_INVALID_STATE
      而且 Run 图保持只读且节点内容不变
  @req:r427

  规则: shared-child-stays-live
    若 libs 与 perf 均指向共享子节点 stream 且 libs 另有 merge 到 conclusion，则对 libs 执行 prune 后：libs 必须标为 pruned；stream 因仍有活父 perf 必须保持未剪枝；conclusion 不得被剪枝；libs→conclusion 的 merge 边必须仍在

    场景: shared-child-kept-live
      假如 libs 与 perf 均指向共享子节点 stream 且 libs 另有 merge 到 conclusion
      当 对 libs 执行 prune
      那么 libs 标为 pruned 且 stream 因仍有活父 perf 保持未剪枝
      而且 conclusion 不被剪枝且 libs→conclusion 的 merge 边仍在
  @req:r428

  规则: exclusive-child-cascades
    若 data 仅有独占子 minimize 且 minimize merge 到 conclusion，则对 data 执行 prune 后 data 与 minimize 必须均标为 pruned；minimize→conclusion 的 merge 边必须保留；conclusion 不得被剪枝

    场景: exclusive-child-cascades
      假如 data 仅有独占子 minimize 且 minimize merge 到 conclusion
      当 对 data 执行 prune
      那么 data 与 minimize 均标为 pruned
      而且 minimize→conclusion 的 merge 边保留且 conclusion 不被剪枝
  @req:r429

  规则: reject-protected-root
    若 Run 处于 running 且存在 node_root_* 节点，则对该 root 的 prune 请求必须被拒绝且图保持不变

    场景: protected-root-prune-rejected
      假如 Run 处于 running 且图中存在 node_root_* 节点
      当 对该 root 节点发起 prune 请求
      那么 请求被拒绝
      而且 图保持不变
  @req:r430

  规则: cancel-aborts-active
    若某节点的检索或综合正在进行时用户调用 cancel，则活动单元必须中止、状态进入 cancelled（或协作收尾至 cancelled）且 checkpoint 已落盘

    场景: cancel-mid-unit-aborts-and-checkpoints
      假如 某节点的检索或综合正在进行
      当 用户调用 cancel
      那么 活动单元被中止且状态进入 cancelled（或协作收尾至 cancelled）
      而且 checkpoint 已落盘
  @req:r431

  规则: reject-client-authored-closure
    客户端以非命令口方式提交任意节点集合作为权威剪枝结果时，请求必须被拒绝（或该接口不存在），图必须仅能经 prune 等命令口变更
  @req:r432

  规则: chat-separate-from-run-stream
    已订阅 Run stream 的客户端发起节点 chat 时，chat 正文事件必须不出现在 Run stream 的事件名集合中
  @req:r433

  规则: max-nodes-respected
    若 planner 提议的支路会使节点数超过 Run.maxNodes 预算，则服务端必须裁剪或拒绝扩展，节点数不得超过预算

    场景: planner-trimmed-to-max-nodes
      假如 planner 提议的支路会使节点数超过 Run.maxNodes 预算
      当 服务端处理该规划输出
      那么 多余支路被裁剪或扩展被拒绝
      而且 最终节点数不超过预算
  @req:r434

  规则: skip-question-when-branches
    若 Run 已拆解出活 research 节点，则运行循环调度必须跳过 question work-unit，且各 research 节点完成写回

    场景: scheduler-skips-question-unit
      假如 Run 已拆解出活 research 节点
      当 运行循环调度下一单元
      那么 question work-unit 被跳过
      而且 各 research 节点被调度执行并完成写回
  @req:r435

  规则: synthesize-fail-no-heuristic
    若结案模型调用抛错，则 Run status 必须为 failed 且不得存在启发式权威报告

    场景: synthesize-throw-marks-failed
      假如 结案模型调用抛错
      当 内核处理结案结果
      那么 Run status 为 failed
      而且 不存在启发式权威报告
  @req:r436

  规则: retry-does-not-rerun-drain
    对已因结案失败而 failed 且已有支路 evidence 的 Run 执行 retry-synthesize 时，必须复用原 evidence 且不得新增 research work-unit 检索进度

    场景: retry-reuses-existing-evidence
      假如 Run 已因结案失败而 failed 且支路已有 evidence
      当 对其执行 retry-synthesize
      那么 重试复用原 evidence 完成成稿
      而且 不新增 research work-unit 检索进度
  @req:r437

  规则: retry-rejects-completed
    若 Run 已 completed，则调用 retry-synthesize 必须返回 RESEARCH_INVALID_STATE 或等价错误

    场景: retry-completed-run-rejected
      假如 某 ResearchRun 已 completed
      当 调用 retry-synthesize
      那么 返回 RESEARCH_INVALID_STATE 或等价错误
      而且 Run 状态与权威报告保持不变
  @req:r438

  规则: fork-leaves-source-unchanged
    fork 完成后再次读取源 Run 及其 revisions 列表，其内容必须与 fork 前一致

    场景: fork-run-source-unchanged
      假如 源 Run 已有图、报告与 revisions
      当 从某 revision 执行 fork-run 并等待其完成
      那么 再次读取源 Run 及其 revisions 列表与 fork 前一致
      而且 新 Run 的后续变更不回写源 Run
  @req:r439

  规则: page-soft-cap-per-node
    若剩余 6 次读页且有 3 个活 research 节点，则该节点 work-unit 开始时的读页软上限必须为 2

    场景: page-soft-cap-six-over-three
      假如 剩余 6 次读页且有 3 个活 research 节点
      当 某节点 work-unit 开始
      那么 该节点的读页软上限为 2
      而且 work_unit 指令向 agent 暴露该软上限
  @req:r440

  规则: addon-does-not-raise-max-nodes
    当 budget 加购发生时，maxNodes 必须保持不变，不得随加购抬高

    场景: addon-keeps-max-nodes
      假如 发生一次 budget 加购
      当 读取加购后的 Run
      那么 maxSearches 按公式抬高而 maxNodes 保持不变
      而且 后续扩展仍受原 maxNodes 预算约束
  @req:r441

  规则: search-soft-cap-even-split
    若剩余 9 次搜索且有 3 个活 research 节点，则该节点 work-unit 开始时的搜索软上限必须为 3，且仍受 Run.maxSearches 硬顶约束

    场景: search-soft-cap-nine-over-three
      假如 剩余 9 次搜索且有 3 个活 research 节点
      当 某节点 work-unit 开始
      那么 该节点的搜索软上限为 3
      而且 单元内成功 webSearch 次数仍受 Run.maxSearches 硬顶约束
