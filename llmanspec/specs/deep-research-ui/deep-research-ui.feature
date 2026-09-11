# language: zh-CN
# capability: deep-research-ui
# purpose: 定义 Deep Research 产品面（/research-lab）与 Demo 面（/demo/research-lab）的 UI 契约：入口、状态驱动主表面、命令口接线、Eden 权威态与 demo 隔离。
# scope: apps/web/src/features/research-lab/, apps/web/src/api/

功能: deep-research-ui

  @req:r400 @human
  场景: Lab is the only deep-research entry and Eden-only
    - 深研产品主入口 MUST 为 /research-lab/:nid（工作区烧瓶导航、slash 命令与任务抽屉仅导航此产品路径）；产品路径 MUST 仅使用服务端 Eden ResearchRun 权威控制器（或等价实现），MUST NOT 经 VITE_LAB_FIXTURE 或 mode=fixture 切换为 xlsx-lib 定时回放权威；旧工作区深研模式入口 MUST NOT 再作为深研主入口或主路径；MUST NOT 删除 ResearchRun 后端 API。

  @req:r401 @human
  场景: H1 create form on desk
    - DeepResearchDesk MUST 提供显式 useNotebookSources 与 allowWeb 开关（表单初始均开启；创建请求 MUST 显式携带两个开关的所选值，MUST NOT 依赖服务端对省略字段的默认推断）、台内 sourceIds 多选、以及浅/中/深 depth（默认中）；当 useNotebookSources 为 true 且未选来源、或两开关皆关、或 topic 为空时 MUST 禁用开始；sourceIds MUST NOT 隐式绑定工作区勾选状态。

  @req:r402 @human
  场景: Queue freshness without list SSE
    - Desk 队列 MUST 在打开时拉取 notebook 作用域 listRuns；当存在非终态 Run 时 MUST 以短间隔轮询刷新，全终态或关闭 Desk 时 MUST 停止轮询；创建成功、关闭详情返回、以及详情内导致状态变化的操作之后 MUST 立即再拉 list；MUST NOT 引入 notebook 级 list SSE。

  @req:r403 @human
  场景: Run detail layer keeps the desk mounted
    - 打开 Run 详情时 MUST 使用高于工作区顶栏 E1 的 modal Layer，且 Desk MUST 保持挂载；关闭详情后 MUST 恢复 Desk 的 tab/查询/队列原样；Escape 或点击详情遮罩 MUST 仅关闭详情；同时 MUST 最多展示一个 Run 详情（切换卡片替换当前详情）。

  @req:r404 @human
  场景: Status-driven primary surface
    - Run 详情 MUST 按状态切换主表面：queued/running/awaiting_confirm 以研究图为主且报告草稿默认折叠；completed 以结构化报告为主且图降为只读次级入口；failed/cancelled 以状态说明为主并在可用时展示末次图或草稿；MUST NOT 提供并列的独立「研究思路」页面，也 MUST NOT 使用永久左右分栏作为唯一布局。

  @req:r405 @human
  场景: ResearchGraph applies D1 patches
    - 详情内研究图 MUST 由新建 ResearchGraph（xyflow）渲染，并 MUST 应用 SSE graph_patch 增量 upsert/remove；节点 MUST 反映 conclusionStatus 语义色（工作区语义色；pruned 降透明度）；MUST NOT 复用或改造 MindmapViewer 作为深研图实现。

  @req:r406 @human
  场景: Node inspector prune fork convert
    - 在 running 或 awaiting_confirm 时，用户单击节点 MUST 打开轻量 inspector，并 MUST 提供剪枝与 fork（fork 可带可选 hint）且在执行前 MUST 有轻量二次确认；节点 Convert 入口 MUST 淡化展示；completed/failed/cancelled 时图与 inspector MUST 只读且 MUST NOT 继续 prune/fork。

  @req:r407 @human
  场景: M1 confirm bar on detail
    - 当 Run 进入 awaiting_confirm 时，详情顶栏 MUST 展示 M1 确认条（预算将尽或扩支路），并 MUST 提供确认动作；图上对应节点/区域 MUST 可高亮；MUST NOT 恢复逐步审批计划 UI。

  @req:r408 @human
  场景: CitationsControl adapter for report
    - 报告面 MUST 复用 CitationsControl 展示引用；前端 MUST 将 Run 全局 citation map 适配为 CitationsControl 所需 Citation 形；MUST NOT 为深研另建平行的引用弹层组件（除非复用组件无法满足最小字段再做最小扩展）。本条为此约束的 canonical 场景（Eden 报告面对齐见 r432）。

  @req:r409 @human
  场景: Convert feedback is toast only
    - 显式 convertToNote/convertToSource 成功或失败 MUST 以 toast（或同等非模态反馈）通知用户；MUST NOT 弹出强制转化确认对话框；成功反馈 MAY 提供打开笔记或来源的弱链接；Eden 模式下成功 toast 提供可点击打开工作区动作为 MUST（见 r446）。

  @req:r410 @human
  场景: Research error surfacing
    - Desk 与详情 MUST 将 RESEARCH_INVALID_STATE 与 RESEARCH_BUDGET 映射为用户可见内联错误与 toast；其他错误 MUST 走既有 AppHttpError/信封展示路径；MUST NOT 静默吞掉这些专用错误码。

  @req:r412 @human
  场景: No run URL deep link in v1
    - 深研 UI MUST NOT 被动依赖 URL query/path 深链恢复特定 Run 状态（报告页 ?rid= 及用户显式动作 / slash 命令发起的 ?rid=/topic 导航除外，见 r452/r460）；被动刷新/直达时打开详情 MUST 由会话内 UI 状态驱动。

  @req:r413 @human
  场景: i18n and reachable Lab entry
    - 深研相关用户可见文案 MUST 走前端 i18n（t()）；仓库 MUST 至少保留一条可达 Lab 入口的回归（testid 或等价）。

  @req:r414 @human
  场景: Pruned branch fade and failed merge retain
    - 研究图 UI MUST 将 conclusionStatus=pruned 的节点以降透明度（或等价弱化）展示；触达 pruned 节点的边 MUST 弱化描边但仍可见；来自 pruned 节点的 merge 边 MUST 保留且标签可继续显示「汇入」（或产品等价文案），MUST NOT 因剪枝从画布移除该 merge；当存在失败汇入时，结论节点 MUST 以可见文案或脚注提示「部分汇入失败」（或等价）。

  @req:r415 @human
  场景: Thin client command ports for Lab
    - Deep Research Lab 展示层 MUST 以 GET ResearchRun 与 SSE graph_patch/status/confirm 作为图与状态的展示权威；用户剪枝、分叉、确认、取消、转化、节点字段修改 MUST 仅调用对应 HTTP 命令口；客户端 MAY 做可丢弃的本地预览，但在命令响应或后续 graph_patch 到达后 MUST 以服务端结果为准回写；默认生产路径 MUST NOT 将本地定时回放或伪造图作为 Run 的权威状态机（fixture 仅显式非生产开关）。

  @req:r416 @human
  场景: Role-preferring graph render
    - 研究图 UI MUST 优先依据节点 role（question|research|conclusion）区分交互与保护态展示；当 role 缺失时 MUST 回退到既有 id 前缀或 merge 目标启发式以保持兼容；MUST NOT 因缺少精致视觉规格而阻塞命令口接线。

  @req:r417 @human
  场景: Node chat UI wires proposals to commands
    - 节点对话 UI MUST 消费独立 chat SSE 展示正文与提案；用户接受剪枝/分叉/改查询/定态/确认类提案（含 Eden ActionProposal 的 open_report 导航）时 MUST 调用对应 prune/fork/PATCH/confirm 命令口；MUST NOT 仅在本地改图作为权威；打开报告类动作可为纯前端导航。本条为此约束的 canonical 场景（Eden 侧对齐见 r439）。

  @req:r418 @human
  场景: Desk canvas prefs from Lab mechanisms
    - Desk 研究图 MUST 提供与 Lab 对齐的画布机制入口（至少布局方向或算法偏好、以及小地图可开关之一档）；这些偏好 MAY 仅存于客户端；MUST NOT 因此新增服务端编排 API 或改变图 SSOT。

  @req:r419 @human
  场景: Revisions UI over server snapshots
    - Desk（或报告面）MUST 能列出并查看服务端 revisions，并 MUST 支持创建当前快照与恢复到某 revision（经 API）；恢复成功后画布与报告 MUST 反映服务端快照内容（经 GET run 或 graph_patch 对齐）；客户端本地暂存（sessionStorage/localStorage 等）MUST NOT 作为生产权威版本源——本条为此禁令的 canonical 约束。

  @req:r423 @human
  场景: Lab wires via Eden and shared schemas
    - Lab 对接 ResearchRun MUST 使用 Eden treaty 与 @crystalith/shared research schemas（及 ErrorEnvelope）；MUST NOT 新增与 shared 同域异形的平行 wire DTO；MUST NOT 删除或绕过 /v2/notebooks/:nid/research*。

  @req:r425 @human
  场景: Lab task inbox stays fresh with Run state
    - Lab 任务抽屉与 ResearchTasksTrigger badge MUST 共享 notebook 作用域 listRuns（共享同一任务列表数据源与缓存键）；Compose 创建成功、HTTP confirm/cancel/prune/fork 成功、以及 SSE status/confirm/report_ready 之后 MUST 立即 mutate 或等效 refresh 任务列表；activeCount MUST 仅统计 status 为 queued、running 或 awaiting_confirm 的任务，completed/failed/cancelled MUST NOT 计入；打开任务抽屉时 MAY revalidate；切换 notebook MUST 丢弃旧 notebook 的 SWR 缓存。

  @req:r426 @human
  场景: Lab exposes cancel for active Eden runs
    - Eden 模式下当 ResearchRun status 为 queued、running 或 awaiting_confirm 时，Lab MUST 暴露取消入口（顶栏主/次操作和/或任务抽屉行操作）；用户触发后 MUST 调用 POST …/research/:rid/cancel；成功或 SSE 终态后 Run status MUST 变为 cancelled，且 MUST 按 r425 立即 refresh 任务 inbox；completed、failed、cancelled MUST NOT 再提供取消。

  @req:r427 @human
  场景: Eden primary action maps to cancel not fixture pause
    - Eden 模式下顶栏主操作 MUST 与 ResearchRun 生命周期对齐：queued 或 running 时主操作 MUST 映射协作 cancel（MUST NOT 调用 fixture pause 空操作）；awaiting_confirm 时 MUST 保持「生成结论」主操作与「继续深挖」次操作；cancel 成功后 UI MUST 展示 cancelled 终态说明。

  @req:r428 @human
  场景: Compose copy switches by eden or fixture mode
    - LabComposePanel MUST 按 mode（eden 或 fixture）切换说明文案与底部 hint；eden 模式 MUST NOT 将 xlsx fixture、演示回放或「接线后将创建」表述为权威或默认路径，且「填入示例主题」控件 MUST 使用中性文案或隐藏 fixture 专属措辞；fixture 模式 MAY 保留 fixture 演示说明与 xlsx-lib 示例主题。

  @req:r430 @human
  场景: Eden openReport navigates to real report page
    - Eden 模式下 Lab MUST NOT 以 toast 代替报告页；用户触发 openReport（顶栏、抽屉或等价 CTA）时 MUST 导航至 /research-lab/:nid/report 并携带当前 Run 的 ?rid= query；MUST NOT 以 fixture 专用的默认修订创建函数作为 Eden 默认路径。

  @req:r431 @human
  场景: LabReportPage loads Run report as SSOT
    - Eden 模式下的 LabReportPage MUST 通过 GET …/research/:rid 加载 ResearchRun.report 作为报告正文与 citations 的权威源；MUST 渲染结构化 sections；MUST NOT 以 labRevisions 或 sessionStorage 作为 Eden 默认权威。

  @req:r432 @human
  场景: Eden report uses CitationsControl adapter
    - Eden 报告面 MUST 将 ResearchReport.citations 经 adapter 复用 CitationsControl 展示引用（对齐 r408）；MUST NOT 为 Eden 报告另建平行引用弹层。

  @req:r433 @human
  场景: Eden export reads Run report not stub toast
    - Eden 模式下 「从图导出建议报告」（或等价能力）MUST 从当前 Run 的 report 或等价结构化数据生成导出（如 markdown）；MUST NOT toast「Eden 报告导出待接」；无 report 时 MUST 展示可见错误。

  @req:r434 @human
  场景: Eden node drawer shows Run evidence citations
    - Eden 模式下 LabNodeDrawer 的引用列表 MUST 由当前 ResearchRun 上节点 evidenceIds 映射而来（标题与 snippet 至少其一）；当 evidenceIds 非空且 Run 已返回对应证据时 MUST NOT 显示「暂无引用」；MUST NOT 以 fixture scenario.citations 作为 Eden 默认引用源。

  @req:r435 @human
  场景: Terminal Run node labels reflect server state
    - 当 ResearchRun status 为 completed、failed 或 cancelled 时，研究图与节点抽屉中的节点状态文案 MUST 反映服务端终态；结论节点在 completed 后 MUST NOT 长期显示「排队…」或等价进行中文案。

  @req:r436 @human
  场景: SSE and terminal GET refresh align node fields
    - Eden Lab 在收到 SSE graph_patch 后 MUST 合并节点与边；在 status 进入 completed、failed 或 cancelled 以及 report_ready 后 MUST getResearchRun 或等效全量刷新以对齐 node.phase、conclusionStatus 与 evidenceIds。

  @req:r437 @human
  场景: awaiting_confirm progress does not contradict playing
    - 当 Run status 为 awaiting_confirm 时，Lab MUST NOT 同时展示「多源探索」playing 横幅与「已暂停」类矛盾文案；playing 推断 MUST 仅对 queued 或 running 为 true；进度条 phase MUST 为 awaiting_confirm。

  @req:r438 @human
  场景: Eden node chat uses HTTP SSE not fixture propose
    - Eden 模式下 LabNodeDrawer 发送对话 MUST 调用 POST …/research/:rid/nodes/:nodeId/chat 并消费独立 chat SSE（chunk、proposal、done、error）；MUST NOT 以 fixture 专用节点对话函数作为默认权威；chat 事件 MUST NOT 混入 Run progress stream 处理器。

  @req:r439 @human
  场景: Eden chat accept maps proposals to command ports
    - Eden 模式下用户接受节点 chat 中的 ActionProposal 时 MUST 调用对应 HTTP 命令口（prune、fork、PATCH、confirm、open_report 导航）；MUST NOT 仅在本地 mutate 图作为权威（对齐 r417 canonical）。

  @req:r441 @human
  场景: Eden Lab report revisions use server API
    - Eden 模式下 LabReportPage MUST 经 GET/POST …/revisions 与 POST …/revisions/:revId/restore 列出、创建与恢复修订快照；恢复后画布与报告反映服务端快照的语义见 r419 canonical；MUST NOT 以 sessionStorage labRevisions 作为 Eden 默认权威。

  @req:r442 @human
  场景: Eden report CoW uses server working endpoints
    - Eden 模式下报告编辑 working copy MUST 经 GET/PUT …/report/working 读写；提交权威报告 MUST 经 PUT …/report；丢弃副本 MUST 调用服务端 discard（或等价端点）并回到权威报告视图；本地暂存持久化禁令见 r419。

  @req:r443 @human
  场景: Eden convert invokes research convert endpoints
    - Eden 模式下报告页与节点抽屉的转化 MUST 调用 POST …/convert-to-note 或 convert-to-source，body 使用 ResearchArtifactRef（report、node 或 evidence）；成功或失败 MUST 以 toast 反馈且无强制确认对话框（对齐 r409）。

  @req:r445 @human
  场景: Lab drawer converts listed evidence via artifact ref
    - 当 LabNodeDrawer 信息引用源列表非空时，每条证据 MUST 提供转为笔记与转为来源入口；Eden 模式下 MUST 调用 POST …/convert-to-note 或 convert-to-source，body 使用 ResearchArtifactRef kind=evidence 与对应 evidenceId；成功或失败 MUST 以 toast 反馈且 MUST NOT 弹出强制转化确认对话框（对齐 r409/r443）；fixture 模式 MUST 仅 stub toast 且 MUST NOT 调用 Eden convert。

  @req:r446 @human
  场景: Convert success toast offers workspace action link
    - 共享 toast 组件 MUST 支持可选 action（label 与 onClick）；Eden convert 成功 toast MUST 提供可点击弱链接/动作以打开工作区（navigateToWorkspace 或等价）；既有仅传 duration 的 toast 调用 MUST 保持兼容；MUST NOT 引入强制确认对话框或平行 toast 实现。

  @req:r447 @human
  场景: Lab Compose depth tier
    - Lab Compose 用户提交创建时，Eden 路径 MUST 在 POST …/research body 中显式携带所选 depth，且 MUST NOT 隐式省略 depth 导致与 UI 选择不一致；深度档位集合与默认档位、以及档位到预算参数（如 maxNodes/maxSearches）的映射属服务端规则，见 deep-research-runtime r305。

  @req:r448 @human
  场景: Lab progress ledger panel
    - Eden 模式下 Lab MUST 将 GET …/research/:rid/progress 账本与/或 SSE progress 事件 surfaced 为可见的 timeline 或 metrics 面板（非仅 activity log）；面板 MUST 展示结构化进度事件（至少 kind、headline、时间戳，可选 nodeId）；加载 Run 时 MUST 拉取 progress gap-fill，流式追加 MUST 与 ledger seq 对齐；MUST NOT 以 fixture LabPhase 定时百分比或前端 timer 作为 Eden Run 的权威进度来源。

  @req:r449 @human
  场景: Eden M1 confirm surface by confirmKind
    - 当 Run status 为 awaiting_confirm 时，Lab MUST 按 confirmKind（budget、expand_branch、reexpand）展示分化文案；budget 文案 MUST 表达搜索预算触顶并可加购继续或出报告；MUST 高亮 confirmBranchNodeId 对应图区域；MUST 暴露 continue、finish_report、approve_branch 与 skip_branch（及 reexpand 对应动作）并经 Eden confirm 命令口执行；RESEARCH_BUDGET 与 RESEARCH_INVALID_STATE MUST 映射为可见错误（对齐 r410）；MUST NOT 恢复逐步计划审批 UI。

  @req:r450 @human
  场景: Eden Lab phase labels from progress and graph
    - Eden 模式下 Lab 相位标签 MUST 在 queued/running/completed 之外，经 progress 事件与节点 phase/图状态富化为与 fixture 可比的 evaluate/integrate 等相位；顶栏与 progress ledger MUST 共用同一推导；Eden 路径 MUST NOT 以 fixture timer 回放作为相位权威态。

  @req:r451 @human
  场景: Eden revision restore reloads graph on return
    - Eden 模式下用户经 revisions API 恢复快照后，返回图作业台时 MUST 经 GET ResearchRun 重载并应用 nodes/edges，使画布与 restored 快照一致（恢复即刷新的 canonical 语义见 r419）；MUST NOT 在报告已恢复而图仍显示旧态的情况下以本地切片恢复函数静默吞掉刷新。

  @req:r452 @human
  场景: Workspace chat deep research commands
    - 工作区 chat 输入 MUST 支持文档化的 / slash 命令以打开 Lab Compose、预填 topic、或深链已有 Run（/research-lab/:nid 与可选 ?rid= / ?topic=）；实现 MUST 经 Eden 默认路径（fixture 下仍可导航 Lab）；命令 MUST 由 GET /v2/commands 以 kind=nav 暴露；确认执行时 MUST NOT 将深研 slash 当作普通 QA 消息发送；烧瓶与 Lab Compose 与任务抽屉 MUST 保持主要深研入口；MUST NOT 使 chat 成为唯一深研入口；MUST NOT 以 @ 提及作为本变更必达面（slash-only）。

  @req:r453 @human
  场景: Eden Lab production e2e gate
    - 仓库 MUST 提供 @p0（或等价）Playwright 路径，在 VITE_LAB_FIXTURE 未设时演练 Eden Lab：Compose 创建 → 图含 nodes/edges → M1 confirm → 报告页 → convert；该门禁 MUST 作为生产默认深研路径对拍证明；MUST NOT 仅以 fixture 回放 smoke 充当生产 parity 门禁。

  @req:r454 @human
  场景: Lab compose and retry expose model picker
    - Lab Compose MUST 允许用户可选选择 modelId 并在 POST create 时发送（省略则服务端默认）；当 Run status 为 failed 且 failureReason 为结案类失败时 Lab MUST 展示可见错误与「重试结案」入口，并 MUST 允许更换 model 后调用 retry-synthesize；MUST NOT 在 workspace chat 本变更中新增换模 UI。

  @req:r455 @human
  场景: Failed synthesize has no heuristic report UI
    - 当结案失败导致 Run failed 时 Lab MUST NOT 将启发式证据清单展示为权威报告正文；用户 MUST 能通过重试结案（可换模）恢复；0 证据但 completed 的诚实成稿 MUST 仍按普通报告渲染。

  @req:r457 @human
  场景: Demo lab isolated under demo prefix
    - xlsx-lib / fake 演示（含 fixture 节点对话、本地修订演示与 sessionStorage 修订演示）MUST 落在独立目录并经 /demo/research-lab/:nid（及 report）暴露；该路由 MUST 仅在 import.meta.env.DEV 为真或 VITE_LAB_DEMO=1 时注册；演示 MUST 可演练既定设计面（图交互、节点抽屉、报告与 cite、revisions、画布设置），但 MUST NOT 作为产品权威、MUST NOT 被误认为已接线生产态；产品入口 MUST NOT 链接到 demo；Demo 类型与控制器 MUST NOT 回流为产品页的 fixture/eden 双模联合分支。

  @req:r458 @human
  场景: cl-prd-demo skill documents demo-first flow
    - 仓库 MUST 提供 demo-first 流程文档（skill 或等价载体），文档化「Demo 假跑定形态 → capability 盘点 → Eden 接线提案/实施」流程；流程工具 MUST NOT 引入第二套生产编排 SSOT。

  @req:r459 @human
  场景: Lab surfaces request-reexpand confirm
    - Lab MUST 提供显式再扩展入口并调用 request-reexpand；当 confirmKind=reexpand 时 MUST 展示批准/跳过并经 confirm 命令口执行；MUST NOT 用 timer 冒充再拆权威态。

  @req:r460 @human
  场景: Lab revision fork-run entry
    - Eden 报告页 MUST 提供「基于此快照新开研究」（或等价）入口，对当前选中 revision 调用 fork-run；成功后 MUST 导航至产品 Lab `/research-lab/:nid?rid=<newRunId>`；MUST NOT 改写源 Run；MUST NOT 以 sessionStorage revisions 作为 fork 权威。

  @req:r461 @human
  场景: Lab proactive search budget add-on
    - Eden Lab 在 Run 为 running 或 awaiting_confirm(budget) 时 MUST 在进度条旁（或等价显眼位置）提供「增加检索预算」入口；用户触发后 MUST 调用加购命令口（add-budget 或等价）按服务端公式抬高 maxSearches；agent 加购提议被用户接受后 MUST 走同一命令口；MUST NOT 仅本地改显示额度。

  @req:r462 @human
  场景: Lab partial completion after budget finish
    - 当 Run 因预算触顶后 finish_report 完成且图中仍有 missing/未覆盖 research 节点时，Lab MUST 展示「预算用尽·部分完成」（或等价）可见提示；报告面 MUST 不掩盖该缺口。

  @req:r400 @human
  场景: sources-has-no-deep-mode-toggle
    - 工作区来源面板的搜索/模式 UI MUST NOT 出现 Fast/Deep 深研模式切换或深研队列主入口等旧深研模式残留。

  @req:r401 @human
  场景: empty-sources-disables-start
    - 当 useNotebookSources 开启且台内未选任何来源时，用户尝试开始深研 MUST 保持开始控件禁用，且 MUST NOT 发出创建请求。

  @req:r413 @human
  场景: topbar-fast-only-and-lab-reachable
    - 工作区顶栏 MUST NOT 呈现旧深研 Desk 入口，且仓库回归（e2e 或 Rstest）MUST 能断言 Lab 入口仍可发现。

  @req:r416 @human
  场景: role-or-prefix-protects-sink
    - 图中 conclusion 节点带 role=conclusion（或既有 id 前缀识别）时 MUST NOT 作为可剪枝研究支路入口展示，与服务端剪枝保护一致。

  @req:r418 @human
  场景: canvas-pref-does-not-call-graph-api
    - 用户切换画布布局方向或小地图偏好生效时，MUST NOT 因此发出修改 research graph 的命令口请求。

  @req:r425 @human
  场景: compose-create-increments-badge
    - 当 Lab 已接线 Eden 且当前 activeCount 为 0 时，用户 Compose 创建 Run 成功后任务列表 MUST 包含新 Run 且 badge activeCount MUST 相应增加。

  @req:r425 @human
  场景: run-terminal-clears-badge
    - 当列表中一项 awaiting_confirm 的 Run 经用户 confirm 或 SSE 变为 completed 后，任务列表 status MUST 更新且 badge activeCount MUST 归零。

  @req:r426 @human
  场景: cancel-from-header-running
    - 当 Eden Lab 打开且 Run status 为 running 时，用户从顶栏触发取消并确认后 MUST 调用 POST …/research/:rid/cancel，成功后 Run status MUST 变为 cancelled。

  @req:r426 @human
  场景: cancel-from-drawer-awaiting-confirm
    - 当任务抽屉存在 awaiting_confirm 任务时，用户从抽屉行触发取消 MUST 成功，且列表中该任务 status MUST 显示为 cancelled。

  @req:r431 @human
  场景: eden-report-not-sessionstorage
    - 当 sessionStorage 无 labRevisions 时，Eden 报告页 MUST 仍以 Run.report 渲染正文。

  @req:r433 @human
  场景: eden-export-no-report-error
    - 当 Eden Run 无 report 时用户触发导出，MUST 展示可见错误提示，且 MUST NOT 写入 fixture revision。

  @req:r434 @human
  场景: drawer-shows-evidence-when-ids-present
    - 当 Eden Run completed 且某节点 evidenceIds 非空时，打开该节点抽屉 MUST 展示至少一条证据摘要（标题或 snippet 至少其一）。

  @req:r437 @human
  场景: running-shows-playing
    - 当 Run status 为 running 时，playing 推断 MUST 为 true，且 MUST NOT 出现「已暂停」类矛盾文案。

  @req:r443 @human
  场景: convert-node-via-artifact-ref
    - Eden 节点抽屉内将节点转为来源时，请求体 MUST 含 ResearchArtifactRef kind=node 与对应 nodeId。

  @req:r445 @human
  场景: evidence-convert-note-calls-api
    - Eden 节点抽屉内将已列出证据转为笔记时，请求体 MUST 含 ResearchArtifactRef kind=evidence 与对应 evidenceId，且 MUST 出现成功或失败 toast。

  @req:r446 @human
  场景: toast-action-clickable
    - 共享 toast 以 success 与 action 展示时，用户点击 action 标签 MUST 执行其 onClick（如打开工作区）。

  @req:r450 @human
  场景: eden-no-progress-stays-explore
    - 当 Eden Run 为 running 且尚无 progress 事件时，顶栏相位 MUST 展示基础相位（如 explore），MUST NOT 以节点 phase 众数猜测富化相位。

  @req:r452 @human
  场景: slash-compose-prefills-topic
    - 当用户在工作区 chat 输入带 topic 的深研 slash 并确认发送时，Lab Compose MUST 打开且 topic MUST 预填，MUST NOT 立即创建 ResearchRun。

  @req:r453 @human
  场景: eden-graph-has-nodes-edges
    - @p0 Eden Lab 用例 MUST 经稳定锚点（如 research-lab-graph testid）断言画布可见且至少渲染一个研究节点与一条边。

  @req:r457 @human
  场景: demo-not-registered-in-prod-default
    - 生产构建未设 VITE_LAB_DEMO 时 /demo/research-lab/* 路由 MUST NOT 注册，请求回落非 Lab 页面或不可达。
