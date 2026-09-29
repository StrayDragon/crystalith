# language: zh-CN
# capability: deep-research-ui
# purpose: 定义 Deep Research 产品面（/research-lab）与 Demo 面（/demo/research-lab）的 UI 契约：入口、状态驱动主表面、命令口接线、Eden 权威态与 demo 隔离。
# scope: apps/web/src/features/research-lab/, apps/web/src/api/

功能: deep-research-ui

  @req:r99
  规则: Lab is the only deep-research entry and Eden-only
    深研产品主入口 MUST 为 /research-lab/:nid（工作区烧瓶导航、slash 命令与任务抽屉仅导航此产品路径）；产品路径 MUST 仅使用服务端 Eden ResearchRun 权威控制器（或等价实现），MUST NOT 切换为 xlsx-lib 定时回放权威（fixture 切换面已废除，MUST NOT 重新引入任何 fixture 切换面，含环境变量或查询参数）；旧工作区深研模式入口 MUST NOT 再作为深研主入口或主路径；MUST NOT 删除 ResearchRun 后端 API。

    场景: lab-entry-only-eden-authority
      假如 用户从工作区烧瓶导航、slash 命令或任务抽屉进入深研
      当 labRouting.test.ts 断言唯一产品入口为 /research-lab/:nid
      那么 创建与状态流转仅经 Eden ResearchRun 权威接口驱动
      而且 不存在环境变量或查询参数等 fixture 切换面可改变权威
  @req:r100
  规则: H1 create form on desk
    DeepResearchDesk MUST 提供显式 useNotebookSources 与 allowWeb 开关（表单初始均开启；创建请求 MUST 显式携带两个开关的所选值，MUST NOT 依赖服务端对省略字段的默认推断）、台内 sourceIds 多选、以及浅/中/深 depth（默认中）；当 useNotebookSources 为 true 且未选来源、或两开关皆关、或 topic 为空时 MUST 禁用开始；sourceIds MUST NOT 隐式绑定工作区勾选状态。

    场景: compose-form-gates-and-payload
      假如 LabComposePanel 中 useNotebookSources 与 allowWeb 初始均开启
      当 topic 为空、或 useNotebookSources 开启但未选来源、或两开关皆关时尝试开始
      那么 labComposeGate.test.ts 验证开始控件禁用且不发出创建请求
      而且 可用时的创建请求显式携带两开关所选值与所选 depth
  @req:r101
  规则: Queue freshness without list SSE
    Desk 队列 MUST 在打开时拉取 notebook 作用域 listRuns；当存在非终态 Run 时 MUST 以短间隔轮询刷新，全终态或关闭 Desk 时 MUST 停止轮询；创建成功、关闭详情返回、以及详情内导致状态变化的操作之后 MUST 立即再拉 list；MUST NOT 引入 notebook 级 list SSE。
  
    场景: queue-polls-only-while-active
      假如 Desk 打开并已拉取 notebook 作用域 listRuns（researchQueuePoll.test）
      当 队列存在非终态 Run 时
      那么 轮询节流为 5s 短间隔（researchQueuePollInterval>0）
      而且 全终态或队列关闭时
      那么 轮询关闭（interval=0）且不引入任何 notebook 级 list SSE
      而且 创建成功/关闭详情返回/详情内状态变更操作后立即再拉 list（controller 各事件 refreshResearchTasks）

@req:r102
  规则: Run detail layer keeps the desk mounted
    打开 Run 详情时 MUST 使用不替换工作区的叠加层（LabNodeDrawer overlay 模式，经 Layer 系统 z-index 高于图区），Desk（图/队列）MUST 保持挂载；关闭详情（关闭按钮）MUST 仅收起详情层并恢复 Desk 原样；同时 MUST 最多展示一个 Run 详情（单值 selectedNodeId 派生，切换卡片替换当前详情）。
  
    场景: detail-overlay-keeps-desk-mounted
      假如 Lab 打开且选中一个研究节点（LabNodeDrawer.test）
      当 详情叠加层渲染
      那么 Desk 仍在 DOM 中且详情层以 overlay+Layer 系统样式呈现
      而且 点击关闭仅触发 onClose（收起详情）且 Desk 未被卸载

@req:r103
  规则: Status-driven primary surface
    Run 详情 MUST 按状态切换主表面：queued/running/awaiting_confirm 以研究图为主且报告草稿默认折叠；completed 以结构化报告为主且图降为只读次级入口；failed/cancelled 以状态说明为主并在可用时展示末次图或草稿；MUST NOT 提供并列的独立「研究思路」页面，也 MUST NOT 使用永久左右分栏作为唯一布局。

    场景: detail-surface-switches-by-status
      假如 Run 详情已打开且状态在 queued/running/awaiting_confirm、completed、failed/cancelled 间切换
      当 详情按状态重渲染主表面
      那么 非终态以研究图为主且报告草稿默认折叠，completed 以结构化报告为主且图降为只读次级入口
      而且 failed/cancelled 以状态说明为主且不存在并列「研究思路」页面或永久左右分栏唯一布局
  @req:r104
  规则: ResearchGraph applies D1 patches
    详情内研究图 MUST 由新建 ResearchGraph（xyflow）渲染，并 MUST 应用 SSE graph_patch 增量 upsert/remove；节点 MUST 反映 conclusionStatus 语义色（工作区语义色；pruned 降透明度）；MUST NOT 复用或改造 MindmapViewer 作为深研图实现。

    场景: graph-applies-sse-patches
      假如 详情内 ResearchGraph（xyflow）已渲染当前 Run 的研究图
      当 SSE 通道推送 graph_patch 增量
      那么 applyGraphPatch.test.ts 验证节点与边按 upsert/remove 合并
      而且 节点按 conclusionStatus 语义色渲染且 pruned 降透明度，未复用 MindmapViewer
  @req:r105
  规则: Node inspector prune fork convert
    在 running 或 awaiting_confirm 时，用户单击节点 MUST 打开轻量 inspector，并 MUST 提供剪枝与 fork（fork 可带可选 hint）且在执行前 MUST 有轻量二次确认；节点 Convert 入口 MUST 淡化展示；completed/failed/cancelled 时图与 inspector MUST 只读且 MUST NOT 继续 prune/fork。

    场景: inspector-prune-fork-with-confirm
      假如 Run 处于 running 或 awaiting_confirm 且用户单击图中一个节点
      当 在 inspector 中选择剪枝或 fork（可带 hint）并执行
      那么 执行前出现轻量二次确认且确认后经对应命令口生效
      而且 completed/failed/cancelled 时图与 inspector 只读且 nodeQuickActions 不再提供剪枝/fork，Convert 入口淡化
  @req:r106
  规则: Graph keyboard access parity
    在 running 或 awaiting_confirm 时，键盘用户 MUST 能将焦点移至研究图节点并以键盘动作（Enter/Space 或等价）打开节点 inspector；边上可用的剪枝与 fork 操作 MUST 键盘可达（MUST NOT 仅 hover 时可见/可触发）；completed/failed/cancelled 的只读禁令对键盘路径与鼠标路径同等适用；本条 MUST NOT 改变既有鼠标交互行为。

    场景: graph-keyboard-reaches-node-actions
      假如 Run 处于 running 或 awaiting_confirm 且键盘用户将焦点移至研究图节点
      当 以 Enter/Space（或等价）打开 inspector 并以键盘遍历边上的剪枝与 fork 操作
      那么 LabGraph.keyboard.test.tsx 验证这些操作不依赖 hover 即键盘可达
      而且 只读终态下键盘路径与鼠标路径同等禁用且既有鼠标交互不变
  @req:r107
  规则: M1 confirm bar on detail
    当 Run 进入 awaiting_confirm 时，详情顶栏 MUST 展示 M1 确认条（预算将尽或扩支路），并 MUST 提供确认动作；图上对应节点/区域 MUST 可高亮；MUST NOT 恢复逐步审批计划 UI。

    场景: confirm-bar-highlights-branch
      假如 Run 进入 awaiting_confirm
      当 详情顶栏展示 M1 确认条
      那么 confirmHighlight.test.ts 验证确认动作可用且图上对应节点/区域高亮
      而且 不出现逐步审批计划 UI
  @req:r108
  规则: CitationsControl adapter for report
    报告面 MUST 复用 CitationsControl 展示引用；前端 MUST 将 Run 全局 citation map 适配为 CitationsControl 所需 Citation 形；MUST NOT 为深研另建平行的引用弹层组件（除非复用组件无法满足最小字段再做最小扩展）。本条为此约束的 canonical 场景（Eden 报告面对齐见 r126）。

    场景: report-citations-via-adapter
      假如 报告面收到带全局 citation map 的 Run 报告
      当 前端经 researchCitationsAdapter 适配为 CitationsControl 所需 Citation 形
      那么 引用由复用的 CitationsControl 展示
      而且 未为深研另建平行引用弹层组件
  @req:r109
  规则: Convert feedback is toast only
    显式 convertToNote/convertToSource 成功或失败 MUST 以 toast（或同等非模态反馈）通知用户；MUST NOT 弹出强制转化确认对话框；成功反馈 MAY 提供打开笔记或来源的弱链接；Eden 模式下成功 toast 提供可点击打开工作区动作为 MUST（见 r139）。

    场景: convert-feedback-toast-only
      假如 用户触发 convertToNote 或 convertToSource
      当 转化请求成功或失败返回
      那么 edenConvertActions.test.ts 验证以 toast（或同等非模态反馈）通知结果且无强制确认对话框
      而且 Eden 模式成功 toast 提供可点击打开工作区动作
  @req:r110
  规则: Research error surfacing
    Desk 与详情 MUST 将 RESEARCH_INVALID_STATE 与 RESEARCH_BUDGET 映射为用户可见内联错误与 toast；其他错误 MUST 走既有 AppHttpError/信封展示路径；MUST NOT 静默吞掉这些专用错误码。

    场景: research-error-codes-surfaced
      假如 Desk 或详情收到 RESEARCH_INVALID_STATE 或 RESEARCH_BUDGET 错误
      当 错误经既有 AppHttpError/信封路径返回
      那么 界面以用户可见内联错误与 toast 呈现
      而且 专用错误码不被静默吞掉
  @req:r111
  规则: rid query param is intra-app navigation, not an external deep-link guarantee
    v1 不提供可分享/可收藏的外部 Run deep link 保证：系统 MUST NOT 提供分享入口或对外稳定的 Run URL 语义。应用内导航 MAY 携带 `?rid=`，Lab 到达时（含刷新与直达）MUST 依据该参数恢复对应 Run——这是 r152 fork-run 导航与 r145 slash 导航的必要承接；报告页 `?rid=` 语义见 r145/r152。

    场景: intra-app-rid-navigation-restores-run
      假如 应用内显式动作（如 fork-run）导航至 /research-lab/:nid?rid=X
      当 Lab 页面到达并读取 rid
      那么 对应 Run 被恢复为当前研究上下文
      而且 系统不提供任何对外分享/收藏 deep link 入口
  @req:r112
  规则: i18n and reachable Lab entry
    深研相关用户可见文案 MUST 走前端 i18n（t()）；仓库 MUST 至少保留一条可达 Lab 入口的回归（testid 或等价）。

    场景: lab-entry-regression-reachable
      假如 深研相关文案均经 t() 走前端 i18n
      当 运行 e2e/tests/p0-smoke.spec.ts 的 Lab 入口可达回归
      那么 仓库至少保留一条以 testid（或等价）断言 Lab 入口可达的用例
      而且 用户可见文案不出现绕过 i18n 的硬编码字符串
  @req:r113
  规则: Pruned branch fade and failed merge retain
    研究图 UI MUST 将 conclusionStatus=pruned 的节点以降透明度（或等价弱化）展示；触达 pruned 节点的边 MUST 弱化描边但仍可见；来自 pruned 节点的 merge 边 MUST 保留且标签可继续显示「汇入」（或产品等价文案），MUST NOT 因剪枝从画布移除该 merge；当存在失败汇入时，结论节点 MUST 以可见文案或脚注提示「部分汇入失败」（或等价）。

    场景: pruned-fade-keeps-merge-edge
      假如 研究图中存在 conclusionStatus=pruned 的节点、触达它的边与来自它的 merge 边
      当 图按剪枝语义渲染
      那么 pruned 节点降透明度且触达它的边弱化描边但仍可见
      而且 merge 边保留并可继续显示「汇入」，失败汇入时结论节点展示「部分汇入失败」提示
  @req:r114
  规则: Thin client command ports for Lab
    Deep Research Lab 展示层 MUST 以 GET ResearchRun 与 SSE graph_patch/status/confirm 作为图与状态的展示权威；用户剪枝、分叉、确认、取消、转化、节点字段修改 MUST 仅调用对应 HTTP 命令口；客户端 MAY 做可丢弃的本地预览，但在命令响应或后续 graph_patch 到达后 MUST 以服务端结果为准回写；默认生产路径 MUST NOT 将本地定时回放或伪造图作为 Run 的权威状态机（fixture 仅显式非生产开关）。

    场景: lab-mutations-through-command-ports
      假如 Lab 以 GET ResearchRun 与 SSE graph_patch/status/confirm 为展示权威
      当 用户执行剪枝、分叉、确认、取消、转化或节点字段修改
      那么 请求仅发往对应 HTTP 命令口且命令响应或后续 graph_patch 到达后以服务端结果回写
      而且 默认生产路径不将本地定时回放或伪造图作为 Run 的权威状态机
  @req:r115
  规则: Role-preferring graph render
    研究图 UI MUST 优先依据节点 role（question|research|conclusion）区分交互与保护态展示；当 role 缺失时 MUST 回退到既有 id 前缀或 merge 目标启发式以保持兼容；MUST NOT 因缺少精致视觉规格而阻塞命令口接线。

    场景: graph-role-with-prefix-fallback
      假如 研究图节点携带 role=question/research/conclusion
      当 图按 role 区分交互与保护态展示
      那么 role 缺失的节点回退到既有 id 前缀或 merge 目标启发式保持兼容
      而且 命令口接线不因缺少精致视觉规格而受阻
  @req:r116
  规则: Node chat UI wires proposals to commands
    节点对话 UI MUST 消费独立 chat SSE 展示正文与提案；用户接受剪枝/分叉/改查询/定态/确认类提案（含 Eden ActionProposal 的 open_report 导航）时 MUST 调用对应 prune/fork/PATCH/confirm 命令口；MUST NOT 仅在本地改图作为权威；打开报告类动作可为纯前端导航。本条为此约束的 canonical 场景（Eden 侧对齐见 r134）。

    场景: chat-proposals-call-commands
      假如 节点对话 UI 消费独立 chat SSE 并收到剪枝/分叉/改查询/定态/确认类提案
      当 用户接受某一提案（含 Eden ActionProposal 的 open_report 导航）
      那么 acceptNodeChatAction.test.ts 验证调用对应 prune/fork/PATCH/confirm 命令口
      而且 不以本地改图作为权威且打开报告类动作为纯前端导航
  @req:r117
  规则: Desk canvas prefs from Lab mechanisms
    Desk 研究图 MUST 提供与 Lab 对齐的画布机制入口（至少布局方向或算法偏好、以及小地图可开关之一档）；这些偏好 MAY 仅存于客户端；MUST NOT 因此新增服务端编排 API 或改变图 SSOT。

    场景: canvas-prefs-client-only-zero-requests
      假如 Desk 研究图提供画布设置入口（方向 / 布局算法 / 连线 / 小地图）
      当 运行 LabCanvasSettings.test.tsx 并逐一切换画布偏好
      那么 仅触发客户端回调且 fetch 记录为零请求（无 research graph 命令口或服务端编排 API 调用）
      而且 图 SSOT 不因偏好切换改变
  @req:r118
  规则: Revisions UI over server snapshots
    Desk（或报告面）MUST 能列出并查看服务端 revisions，并 MUST 支持创建当前快照与恢复到某 revision（经 API）；恢复成功后画布与报告 MUST 反映服务端快照内容（经 GET run 或 graph_patch 对齐）；客户端本地暂存（sessionStorage/localStorage 等）MUST NOT 作为生产权威版本源——本条为此禁令的 canonical 约束。

    场景: revisions-list-create-restore-via-api
      假如 用户在 Desk 或报告面打开修订列表
      当 创建当前快照并恢复到某一 revision
      那么 列表、创建与恢复均经服务端 API 完成且恢复后画布与报告经 GET run 或 graph_patch 对齐服务端快照
      而且 sessionStorage/localStorage 等客户端本地暂存不作为生产权威版本源
  @req:r119
  规则: Lab wires via Eden and shared schemas
    Lab 对接 ResearchRun MUST 使用 Eden treaty 与 @crystalith/shared research schemas（及 ErrorEnvelope）；MUST NOT 新增与 shared 同域异形的平行 wire DTO；MUST NOT 删除或绕过 /v2/notebooks/:nid/research*。
  @req:r120
  规则: Lab task inbox stays fresh with Run state
    Lab 任务抽屉与 ResearchTasksTrigger badge MUST 共享 notebook 作用域 listRuns（共享同一任务列表数据源与缓存键）；Compose 创建成功、HTTP confirm/cancel/prune/fork 成功、以及 SSE status/confirm/report_ready 之后 MUST 立即 mutate 或等效 refresh 任务列表；activeCount MUST 仅统计 status 为 queued、running 或 awaiting_confirm 的任务，completed/failed/cancelled MUST NOT 计入；打开任务抽屉时 MAY revalidate；切换 notebook MUST 丢弃旧 notebook 的 SWR 缓存。

    场景: task-inbox-refreshes-on-run-events
      假如 Lab 任务抽屉与 ResearchTasksTrigger badge 共享 notebook 作用域 listRuns 缓存键
      当 Compose 创建成功、HTTP confirm/cancel/prune/fork 成功或 SSE status/confirm/report_ready 到达
      那么 researchTasksCache.test.ts 验证任务列表立即 mutate 刷新且 activeCount 仅计 queued/running/awaiting_confirm
      而且 切换 notebook 时丢弃旧 notebook 的 SWR 缓存
  @req:r121
  规则: Lab exposes cancel for active Eden runs
    Eden 模式下当 ResearchRun status 为 queued、running 或 awaiting_confirm 时，Lab MUST 暴露取消入口（顶栏主/次操作和/或任务抽屉行操作）；用户触发后 MUST 调用 POST …/research/:rid/cancel；成功或 SSE 终态后 Run status MUST 变为 cancelled，且 MUST 按 r120 立即 refresh 任务 inbox；completed、failed、cancelled MUST NOT 再提供取消。

    场景: cancel-entry-for-active-runs
      假如 Eden Run status 为 queued、running 或 awaiting_confirm
      当 用户从顶栏操作或任务抽屉行触发取消
      那么 edenCancelFlow.test.ts 验证调用 POST research/:rid/cancel 且终态后按 r120 刷新任务 inbox
      而且 completed、failed、cancelled 状态不再提供取消入口
  @req:r122
  规则: Eden primary action maps to cancel not fixture pause
    Eden 模式下顶栏主操作 MUST 与 ResearchRun 生命周期对齐：queued 或 running 时主操作 MUST 映射协作 cancel（MUST NOT 调用 fixture pause 空操作）；awaiting_confirm 时 MUST 保持「生成结论」主操作与「继续深挖」次操作；cancel 成功后 UI MUST 展示 cancelled 终态说明。

    场景: primary-action-maps-lifecycle
      假如 Eden 模式下 Run 处于 queued 或 running
      当 resolveLabPrimaryAction.test.ts 计算顶栏主操作
      那么 主操作映射为协作 cancel 且不调用 fixture pause 空操作
      而且 awaiting_confirm 时保持「生成结论」主操作与「继续深挖」次操作，cancel 成功后展示 cancelled 终态说明
  @req:r123
  规则: Compose copy switches by eden or fixture mode
    LabComposePanel MUST 按 mode（eden 或 fixture）切换说明文案与底部 hint；eden 模式 MUST NOT 将 xlsx fixture、演示回放或「接线后将创建」表述为权威或默认路径，且「填入示例主题」控件 MUST 使用中性文案或隐藏 fixture 专属措辞；fixture 模式 MAY 保留 fixture 演示说明与 xlsx-lib 示例主题。

    场景: compose-copy-by-mode
      假如 LabComposePanel 按 mode（eden 或 fixture）渲染
      当 渲染说明文案、底部 hint 与「填入示例主题」控件
      那么 eden 模式下不出现 xlsx fixture、演示回放或「接线后将创建」等权威或默认路径表述
      而且 「填入示例主题」用中性文案或隐藏 fixture 措辞，fixture 模式保留演示说明与示例主题
  @req:r124
  规则: Eden openReport navigates to real report page
    Eden 模式下 Lab MUST NOT 以 toast 代替报告页；用户触发 openReport（顶栏、抽屉或等价 CTA）时 MUST 导航至 /research-lab/:nid/report 并携带当前 Run 的 ?rid= query；MUST NOT 以 fixture 专用的默认修订创建函数作为 Eden 默认路径。

    场景: open-report-navigates-with-rid
      假如 Eden 模式下用户触发顶栏、抽屉或等价 CTA 的 openReport
      当 edenReportActions.test.ts 执行导航
      那么 页面导航至 /research-lab/:nid/report 并携带当前 Run 的 ?rid= query
      而且 不以 toast 代替报告页且不走 fixture 专用默认修订创建函数
  @req:r125
  规则: LabReportPage loads Run report as SSOT
    Eden 模式下的 LabReportPage MUST 通过 GET …/research/:rid 加载 ResearchRun.report 作为报告正文与 citations 的权威源；MUST 渲染结构化 sections；MUST NOT 以 labRevisions 或 sessionStorage 作为 Eden 默认权威。

    场景: report-page-loads-run-report
      假如 Eden 模式下 LabReportPage 打开
      当 经 GET research/:rid 加载 ResearchRun
      那么 LabReportPage.eden.test.tsx 验证 report 正文与 citations 以服务端返回为权威并渲染结构化 sections
      而且 labRevisions 或 sessionStorage 不作为 Eden 默认权威
  @req:r126
  规则: Eden report uses CitationsControl adapter
    Eden 报告面 MUST 将 ResearchReport.citations 经 adapter 复用 CitationsControl 展示引用（对齐 r108）；MUST NOT 为 Eden 报告另建平行引用弹层。

    场景: eden-report-citations-adapter
      假如 Eden 报告面收到 ResearchReport.citations
      当 经 adapter 转换后渲染引用
      那么 引用复用 CitationsControl 展示且与 r108 对齐
      而且 未为 Eden 报告另建平行引用弹层
  @req:r127
  规则: Eden export reads Run report not stub toast
    Eden 模式下 「从图导出建议报告」（或等价能力）MUST 从当前 Run 的 report 或等价结构化数据生成导出（如 markdown）；MUST NOT toast「Eden 报告导出待接」；无 report 时 MUST 展示可见错误。

    场景: eden-export-uses-run-report
      假如 Eden 模式下用户触发「从图导出建议报告」（或等价能力）
      当 当前 Run 存在 report 或等价结构化数据
      那么 导出内容由 report 生成（如 markdown）且不出现「Eden 报告导出待接」toast
      而且 无 report 时展示可见错误
  @req:r128
  规则: Eden node drawer shows Run evidence citations
    Eden 模式下 LabNodeDrawer 的引用列表 MUST 由当前 ResearchRun 上节点 evidenceIds 映射而来（标题与 snippet 至少其一）；当 evidenceIds 非空且 Run 已返回对应证据时 MUST NOT 显示「暂无引用」；MUST NOT 以 fixture scenario.citations 作为 Eden 默认引用源。

    场景: drawer-evidence-from-run
      假如 Eden Run 某节点 evidenceIds 非空且 Run 已返回对应证据
      当 打开该节点的 LabNodeDrawer
      那么 引用列表由 evidenceIds 映射出标题或 snippet 至少其一且不显示「暂无引用」
      而且 fixture scenario.citations 不作为 Eden 默认引用源
  @req:r129
  规则: Terminal Run node labels reflect server state
    当 ResearchRun status 为 completed、failed 或 cancelled 时，研究图与节点抽屉中的节点状态文案 MUST 反映服务端终态；结论节点在 completed 后 MUST NOT 长期显示「排队…」或等价进行中文案。

    场景: terminal-node-labels-match-server
      假如 ResearchRun status 进入 completed、failed 或 cancelled
      当 研究图与节点抽屉渲染节点状态文案
      那么 文案反映服务端终态
      而且 completed 后结论节点不长期显示「排队…」或等价进行中文案
  @req:r130
  规则: SSE and terminal GET refresh align node fields
    Eden Lab 在收到 SSE graph_patch 后 MUST 合并节点与边；在 status 进入 completed、failed 或 cancelled 以及 report_ready 后 MUST getResearchRun 或等效全量刷新以对齐 node.phase、conclusionStatus 与 evidenceIds。

    场景: sse-then-terminal-get-refresh
      假如 Eden Lab 收到 SSE graph_patch 并合并节点与边
      当 status 进入 completed、failed 或 cancelled 或 report_ready 到达
      那么 evidenceStatusSync.test.ts 验证触发 getResearchRun 或等效全量刷新对齐 node.phase、conclusionStatus 与 evidenceIds
      而且 刷新后的服务端字段覆盖本地合并结果
  @req:r131
  规则: Run SSE reconnects with bounded backoff and visible state
    Run SSE 意外断开（网络错误、非用户离开、非终态结束）时，客户端 MUST 立即对账 GET ResearchRun；若 Run 处于非终态 MUST 以有界退避自动重订阅同一 SSE 端点（默认 1s/2s/4s，至多 5 次或直至终态，取先到者）；重连期间 UI MUST 呈现可见的「连接中断，正在重连」状态且 MUST NOT 渲染伪造进度；重连成功后 MUST 以 GET progress gap-fill + 后续 SSE 事件补齐中断窗口；重试耗尽或对账发现终态 MUST 停止重试，前者 SHALL 提供明确错误与手动重试入口；用户主动离开页面或 Run 进入终态后 MUST NOT 继续重连。MUST NOT 为此引入 notebook 级 list SSE（r358）。

    场景: sse-reconnect-bounded-backoff
      假如 Run SSE 因网络错误意外断开且对账发现 Run 非终态
      当 客户端以 1s/2s/4s 有界退避重订阅同一 SSE 端点（至多 5 次或直至终态）
      那么 重连期间展示可见的「连接中断，正在重连」且不渲染伪造进度
      而且 重连成功后以 GET progress gap-fill 补齐中断窗口，重试耗尽、终态或用户离开后停止重连
  @req:r132
  规则: awaiting_confirm progress does not contradict playing
    当 Run status 为 awaiting_confirm 时，Lab MUST NOT 同时展示「多源探索」playing 横幅与「已暂停」类矛盾文案；playing 推断 MUST 仅对 queued 或 running 为 true；进度条 phase MUST 为 awaiting_confirm。

    场景: awaiting-confirm-no-playing-banner
      假如 Run status 为 awaiting_confirm
      当 LabStreamBanner 与进度条渲染横幅与 phase
      那么 不同时出现「多源探索」playing 横幅与「已暂停」类矛盾文案
      而且 playing 推断仅对 queued 或 running 为 true 且进度条 phase 为 awaiting_confirm
  @req:r133
  规则: Eden node chat uses HTTP SSE not fixture propose
    Eden 模式下 LabNodeDrawer 发送对话 MUST 调用 POST …/research/:rid/nodes/:nodeId/chat 并消费独立 chat SSE（chunk、proposal、done、error）；MUST NOT 以 fixture 专用节点对话函数作为默认权威；chat 事件 MUST NOT 混入 Run progress stream 处理器；chat error 事件 MUST 以可见错误态呈现（对话区错误提示），MUST NOT 静默无反馈。

    场景: node-chat-http-sse
      假如 Eden 模式下用户在 LabNodeDrawer 发送节点对话
      当 请求发出
      那么 streamNodeChat.test.ts 验证调用 POST research/:rid/nodes/:nodeId/chat 并独立消费 chat SSE 的 chunk/proposal/done/error
      而且 chat 事件不混入 Run progress stream 处理器且 error 事件在对话区呈现可见错误
  @req:r134
  规则: Eden chat accept maps proposals to command ports
    Eden 模式下用户接受节点 chat 中的 ActionProposal 时 MUST 调用对应 HTTP 命令口（prune、fork、PATCH、confirm、open_report 导航）；MUST NOT 仅在本地 mutate 图作为权威（对齐 r116 canonical）。

    场景: eden-chat-accept-maps-commands
      假如 Eden 模式下节点 chat 返回 ActionProposal
      当 用户接受 prune、fork、PATCH、confirm 或 open_report 类提案
      那么 acceptNodeChatAction.test.ts 验证调用对应 HTTP 命令口或执行前端导航
      而且 不以本地 mutate 图作为权威
  @req:r135
  规则: Eden Lab report revisions use server API
    Eden 模式下 LabReportPage MUST 经 GET/POST …/revisions 与 POST …/revisions/:revId/restore 列出、创建与恢复修订快照；恢复后画布与报告反映服务端快照的语义见 r118 canonical；MUST NOT 以 sessionStorage labRevisions 作为 Eden 默认权威。

    场景: eden-revisions-server-api
      假如 Eden 模式下用户在 LabReportPage 管理修订快照
      当 列出、创建或恢复修订
      那么 请求分别经 GET/POST research/:rid/revisions 与 POST research/:rid/revisions/:revId/restore 完成
      而且 sessionStorage labRevisions 不作为 Eden 默认权威
  @req:r136
  规则: Eden report CoW uses server working endpoints
    Eden 模式下报告编辑 working copy MUST 经 GET/PUT …/report/working 读写；提交权威报告 MUST 经 PUT …/report；丢弃副本 MUST 调用服务端 discard（或等价端点）并回到权威报告视图；本地暂存持久化禁令见 r118。

    场景: eden-report-working-copy-endpoints
      假如 Eden 模式下用户编辑报告 working copy
      当 读取、保存、提交或丢弃副本
      那么 读写经 GET/PUT research/:rid/report/working 且提交权威报告经 PUT research/:rid/report
      而且 丢弃副本调用服务端 discard（或等价端点）并回到权威报告视图
  @req:r137
  规则: Eden convert invokes research convert endpoints
    Eden 模式下报告页与节点抽屉的转化 MUST 调用 POST …/convert-to-note 或 convert-to-source，body 使用 ResearchArtifactRef（report、node 或 evidence）；成功或失败 MUST 以 toast 反馈且无强制确认对话框（对齐 r109）。

    场景: eden-convert-endpoints
      假如 用户在 Eden 报告页或节点抽屉触发转化
      当 转化请求发出
      那么 edenConvertActions.test.ts 验证调用 POST research/:rid/convert-to-note 或 convert-to-source 且 body 使用 ResearchArtifactRef（report、node 或 evidence）
      而且 成功或失败以 toast 反馈且无强制确认对话框
  @req:r138
  规则: Lab drawer converts listed evidence via artifact ref
    当 LabNodeDrawer 信息引用源列表非空时，每条证据 MUST 提供转为笔记与转为来源入口；Eden 模式下 MUST 调用 POST …/convert-to-note 或 convert-to-source，body 使用 ResearchArtifactRef kind=evidence 与对应 evidenceId；成功或失败 MUST 以 toast 反馈且 MUST NOT 弹出强制转化确认对话框（对齐 r109/r137）；fixture 模式 MUST 仅 stub toast 且 MUST NOT 调用 Eden convert。

    场景: drawer-evidence-convert-artifact-ref
      假如 LabNodeDrawer 信息引用源列表非空
      当 用户对某条证据点击转为笔记或转为来源
      那么 LabNodeDrawer.evidenceConvert.test.tsx 验证调用对应 convert 端点且 body 为 ResearchArtifactRef kind=evidence 与对应 evidenceId
      而且 结果以 toast 反馈且 fixture 模式仅 stub toast 不调用 Eden convert
  @req:r139
  规则: Convert success toast offers workspace action link
    共享 toast 组件 MUST 支持可选 action（label 与 onClick）；Eden convert 成功 toast MUST 提供可点击弱链接/动作以打开工作区（navigateToWorkspace 或等价）；既有仅传 duration 的 toast 调用 MUST 保持兼容；MUST NOT 引入强制确认对话框或平行 toast 实现。

    场景: convert-toast-action-link
      假如 共享 toast 组件以 success 与可选 action（label 与 onClick）展示
      当 Eden convert 成功 toast 弹出
      那么 toast 提供可点击弱链接/动作打开工作区（navigateToWorkspace 或等价）
      而且 既有仅传 duration 的调用保持兼容且无强制确认对话框或平行 toast 实现
  @req:r140
  规则: Lab Compose depth tier
    Lab Compose 用户提交创建时，Eden 路径 MUST 在 POST …/research body 中显式携带所选 depth，且 MUST NOT 隐式省略 depth 导致与 UI 选择不一致；深度档位集合与默认档位、以及档位到预算参数（如 maxNodes/maxSearches）的映射属服务端规则，见 deep-research-runtime r58。

    场景: compose-sends-explicit-depth
      假如 用户在 Lab Compose 选择浅/中/深 depth 并提交创建
      当 Eden 路径发出 POST research 请求
      那么 useEdenLabController.composeDepth.test.ts 验证 body 显式携带所选 depth
      而且 不因隐式省略 depth 导致与 UI 选择不一致
  @req:r141
  规则: Lab progress ledger panel
    Eden 模式下 Lab MUST 将 GET …/research/:rid/progress 账本与/或 SSE progress 事件 surfaced 为可见的 timeline 或 metrics 面板（非仅 activity log）；面板 MUST 展示结构化进度事件（至少 kind、headline、时间戳，可选 nodeId）；加载 Run 时 MUST 拉取 progress gap-fill，流式追加 MUST 与 ledger seq 对齐；MUST NOT 以 fixture LabPhase 定时百分比或前端 timer 作为 Eden Run 的权威进度来源。

    场景: progress-ledger-panel-surfaced
      假如 Eden Run 打开且 GET research/:rid/progress 账本与 SSE progress 事件可用
      当 加载 Run 并流式追加进度事件
      那么 labProgressLedger.test.ts 验证面板展示结构化事件（至少 kind、headline、时间戳，可选 nodeId）且追加与 ledger seq 对齐
      而且 不以 fixture LabPhase 定时百分比或前端 timer 作为权威进度来源
  @req:r142
  规则: Eden M1 confirm surface by confirmKind
    当 Run status 为 awaiting_confirm 时，Lab MUST 按 confirmKind（budget、expand_branch、reexpand）展示分化文案；budget 文案 MUST 表达搜索预算触顶并可加购继续或出报告；MUST 高亮 confirmBranchNodeId 对应图区域；MUST 暴露 continue、finish_report、approve_branch 与 skip_branch（及 reexpand 对应动作）并经 Eden confirm 命令口执行；RESEARCH_BUDGET 与 RESEARCH_INVALID_STATE MUST 映射为可见错误（对齐 r110）；MUST NOT 恢复逐步计划审批 UI。

    场景: confirm-surface-by-kind
      假如 Run status 为 awaiting_confirm 且 confirmKind 为 budget、expand_branch 或 reexpand
      当 M1 确认面按 confirmKind 渲染文案与动作
      那么 edenConfirmActions.test.ts 验证 budget 文案表达搜索预算触顶且 continue/finish_report/approve_branch/skip_branch 经 Eden confirm 命令口执行
      而且 confirmBranchNodeId 对应图区域高亮且预算错误映射可见且不恢复逐步计划审批 UI
  @req:r143
  规则: Eden Lab phase labels from progress and graph
    Eden 模式下 Lab 相位标签 MUST 在 queued/running/completed 之外，经 progress 事件与节点 phase/图状态富化为与 fixture 可比的 evaluate/integrate 等相位；顶栏与 progress ledger MUST 共用同一推导；Eden 路径 MUST NOT 以 fixture timer 回放作为相位权威态。

    场景: phase-labels-from-progress-graph
      假如 Eden Run 收到 progress 事件且节点 phase/图状态更新
      当 顶栏与 progress ledger 推导相位标签
      那么 deriveEdenLabPhase.test.ts 验证两者共用同一推导并富化出 evaluate/integrate 等相位
      而且 Eden 路径不以 fixture timer 回放作为相位权威态
  @req:r144
  规则: Eden revision restore reloads graph on return
    Eden 模式下用户经 revisions API 恢复快照后，返回图作业台时 MUST 经 GET ResearchRun 重载并应用 nodes/edges，使画布与 restored 快照一致（恢复即刷新的 canonical 语义见 r118）；MUST NOT 在报告已恢复而图仍显示旧态的情况下以本地切片恢复函数静默吞掉刷新。

    场景: restore-reload-graph-on-return
      假如 用户在 Eden 报告页经 revisions API 恢复某一快照
      当 返回图作业台
      那么 labRunReloadGate.test.ts 验证经 GET ResearchRun 重载并应用 nodes/edges 使画布与 restored 快照一致
      而且 报告已恢复而图仍显示旧态时不以本地切片恢复函数静默吞掉刷新
  @req:r145
  规则: Workspace chat deep research commands
    工作区 chat 输入 MUST 支持文档化的 / slash 命令以打开 Lab Compose、预填 topic、或深链已有 Run（/research-lab/:nid 与可选 ?rid= / ?topic=）；实现 MUST 经 Eden 默认路径（fixture 下仍可导航 Lab）；命令 MUST 由 GET /v2/commands 以 kind=nav 暴露；确认执行时 MUST NOT 将深研 slash 当作普通 QA 消息发送；烧瓶与 Lab Compose 与任务抽屉 MUST 保持主要深研入口；MUST NOT 使 chat 成为唯一深研入口；MUST NOT 以 @ 提及作为本变更必达面（slash-only）。

    场景: chat-slash-commands-nav
      假如 用户在工作区 chat 输入深研 slash 命令
      当 确认执行
      那么 researchChatCommands.test.ts 验证导航 /research-lab/:nid（可选 ?rid= 或 ?topic=）且命令由 GET /v2/commands 以 kind=nav 暴露
      而且 深研 slash 不被当作普通 QA 消息发送且 chat 不成为唯一深研入口
  @req:r146
  规则: Eden Lab production e2e gate
    仓库 MUST 提供 @p0（或等价）Playwright 路径，在默认（生产）构建配置下演练 Eden Lab：Compose 创建 → 图含 nodes/edges → M1 confirm → 报告页 → convert；该门禁 MUST 作为生产默认深研路径对拍证明；MUST NOT 仅以 fixture 回放 smoke 充当生产 parity 门禁。

    场景: p0-eden-lab-gate
      假如 默认（生产）构建配置下运行 e2e/tests/p0-eden-lab.spec.ts 的 R01
      当 演练 Compose 创建 → 图含 nodes/edges → M1 confirm → 报告页 → convert 全链路
      那么 全链路在生产默认路径通过且数据来自 Eden
      而且 不以 fixture 回放 smoke 充当生产 parity 门禁
  @req:r147
  规则: Lab compose and retry expose model picker
    Lab Compose MUST 允许用户可选选择 modelId 并在 POST create 时发送（省略则服务端默认）；当 Run status 为 failed 且 failureReason 为结案类失败时 Lab MUST 展示可见错误与「重试结案」入口，并 MUST 允许更换 model 后调用 retry-synthesize；MUST NOT 在 workspace chat 本变更中新增换模 UI。

    场景: compose-model-and-retry-synthesize
      假如 用户在 Lab Compose 可选选择 modelId 并提交创建
      当 POST create 发出
      那么 useEdenLabController.modelRetry.test.ts 验证 body 携带所选 modelId（省略则服务端默认）
      而且 Run failed 且 failureReason 为结案类失败时展示可见错误与「重试结案」入口并可换 model 调用 retry-synthesize
  @req:r148
  规则: Failed synthesize has no heuristic report UI
    当结案失败导致 Run failed 时 Lab MUST NOT 将启发式证据清单展示为权威报告正文；用户 MUST 能通过重试结案（可换模）恢复；0 证据但 completed 的诚实成稿 MUST 仍按普通报告渲染。
  
    场景: failed-run-report-gating
      假如 Lab 派生状态来自 run（labGraphGates.test）
      当 run status=failed 时
      那么 reportVisible=false（报告入口隐藏，不渲染启发式清单为正文）且合成失败横幅提供换模+重试结案入口
      而且 status=completed 且携带 report（含 0 证据诚实成稿）时 reportVisible=true 按普通报告渲染

@req:r149
  规则: Demo lab isolated under demo prefix
    xlsx-lib / fake 演示（含 fixture 节点对话、本地修订演示与 sessionStorage 修订演示）MUST 落在独立目录并经 /demo/research-lab/:nid（及 report）暴露；该路由 MUST 仅在 import.meta.env.DEV 为真或 VITE_LAB_DEMO=1 时注册；演示 MUST 可演练既定设计面（图交互、节点抽屉、报告与 cite、revisions、画布设置），但 MUST NOT 作为产品权威、MUST NOT 被误认为已接线生产态；产品入口 MUST NOT 链接到 demo；Demo 类型与控制器 MUST NOT 回流为产品页的 fixture/eden 双模联合分支。

    场景: demo-lab-isolated-prefix
      假如 xlsx-lib/fake 演示（fixture 节点对话、本地修订与 sessionStorage 修订演示）位于独立目录
      当 以 DEV 或 VITE_LAB_DEMO=1 访问 /demo/research-lab/:nid 及 report
      那么 labDemoMode.test.ts 与 labRouting.test.ts 验证演示可演练图交互、节点抽屉、报告与 cite、revisions、画布设置
      而且 产品入口不链接 demo 且 Demo 类型与控制器不回流为产品页双模联合分支
  @req:r150
  规则: cl-prd-demo skill documents demo-first flow
    仓库 MUST 提供 demo-first 流程文档（skill 或等价载体），文档化「Demo 假跑定形态 → capability 盘点 → Eden 接线提案/实施」流程；流程工具 MUST NOT 引入第二套生产编排 SSOT。
  @req:r151
  规则: Lab surfaces request-reexpand confirm
    Lab MUST 提供显式再扩展入口并调用 request-reexpand；当 confirmKind=reexpand 时 MUST 展示批准/跳过并经 confirm 命令口执行；MUST NOT 用 timer 冒充再拆权威态。

    场景: request-reexpand-confirm
      假如 Lab 提供显式再扩展入口
      当 用户触发 request-reexpand 且 confirmKind=reexpand 时展示批准/跳过
      那么 批准或跳过经 confirm 命令口执行（e2e R02 覆盖 live → request-reexpand → skip → completed）
      而且 不用 timer 冒充再拆权威态
  @req:r152
  规则: Lab revision fork-run entry
    Eden 报告页 MUST 提供「基于此快照新开研究」（或等价）入口，对当前选中 revision 调用 fork-run；成功后 MUST 导航至产品 Lab `/research-lab/:nid?rid=<newRunId>`；MUST NOT 改写源 Run；MUST NOT 以 sessionStorage revisions 作为 fork 权威。

    场景: fork-run-navigates-new-rid
      假如 用户在 Eden 报告页选中某一 revision 并点击「基于此快照新开研究」（或等价）
      当 fork-run 调用成功返回新 Run
      那么 页面导航至产品 Lab /research-lab/:nid?rid=<newRunId>
      而且 源 Run 未被改写且 sessionStorage revisions 不作为 fork 权威
  @req:r153
  规则: Lab proactive search budget add-on
    Eden Lab 在 Run 为 running 或 awaiting_confirm(budget) 时 MUST 在进度条旁（或等价显眼位置）提供「增加检索预算」入口；用户触发后 MUST 调用加购命令口（add-budget 或等价）按服务端公式抬高 maxSearches；agent 加购提议被用户接受后 MUST 走同一命令口；MUST NOT 仅本地改显示额度。

    场景: add-budget-command-port
      假如 Eden Run 为 running 或 awaiting_confirm(budget)
      当 用户点击进度条旁（或等价显眼位置）的「增加检索预算」入口
      那么 加购经 add-budget 或等价命令口按服务端公式抬高 maxSearches
      而且 agent 加购提议被接受后走同一命令口且不仅本地改显示额度
  @req:r154
  规则: Lab partial completion after budget finish
    当 Run 因预算触顶后 finish_report 完成且图中仍有 missing/未覆盖 research 节点时，Lab MUST 展示「预算用尽·部分完成」（或等价）可见提示；报告面 MUST 不掩盖该缺口。

    场景: partial-completion-banner
      假如 Run 因预算触顶后经 finish_report 完成且图中仍有 missing/未覆盖 research 节点
      当 Lab 渲染完成态详情与报告面
      那么 展示「预算用尽·部分完成」（或等价）可见提示
      而且 报告面不掩盖该缺口
  @req:r442

  规则: sources-has-no-deep-mode-toggle
    工作区来源面板的搜索/模式 UI MUST NOT 出现 Fast/Deep 深研模式切换或深研队列主入口等旧深研模式残留。

    场景: sources-panel-no-deep-mode-residue
      假如 扫描 apps/web/src/features/workspace/domains/sources/ 的源码
      当 运行 sourcesNoDeepModeToggle.test.ts 的负向静态扫描
      那么 来源面板源码无 Fast/Deep 深研模式切换或深研队列主入口等残留文案
      而且 'Fast Research' 网搜通道元数据不被误报（positive control 通过）
  @req:r443

  规则: empty-sources-disables-start
    当 useNotebookSources 开启且台内未选任何来源时，用户尝试开始深研 MUST 保持开始控件禁用，且 MUST NOT 发出创建请求。

    场景: empty-sources-keeps-start-disabled
      假如 useNotebookSources 开启且台内未选任何来源
      当 用户尝试开始深研
      那么 开始控件保持禁用
      而且 不发出创建请求
  @req:r444

  规则: topbar-fast-only-and-lab-reachable
    工作区顶栏 MUST NOT 呈现旧深研 Desk 入口，且仓库回归（e2e 或 Rstest）MUST 能断言 Lab 入口仍可发现。

    场景: topbar-no-desk-lab-reachable
      假如 打开工作区顶栏
      当 检查深研入口
      那么 顶栏不呈现旧深研 Desk 入口
      而且 e2e（p0-smoke）或 Rstest 回归能断言 Lab 入口仍可发现
  @req:r445

  规则: role-or-prefix-protects-sink
    图中 conclusion 节点带 role=conclusion（或既有 id 前缀识别）时 MUST NOT 作为可剪枝研究支路入口展示，与服务端剪枝保护一致。
  
    场景: conclusion-node-not-prunable
      假如 图中存在 role=conclusion 的汇节点（labGraphGates.test）
      当 经 labLayout 派生边动作
      那么 该节点的入边 canPrune/canFork 均为 false（node_conclusion_ 前缀识别同效）
      而且 role=research 的入边 canPrune=true（readOnly 时除外，对照）

@req:r446

  规则: canvas-pref-does-not-call-graph-api
    用户切换画布布局方向或小地图偏好生效时，MUST NOT 因此发出修改 research graph 的命令口请求。
  
    场景: canvas-preferences-are-client-only
      假如 Lab 画布设置面板打开（LabCanvasSettings.test 的 MSW 全量请求记录器）
      当 用户切换布局方向/算法/连线/小地图偏好
      那么 记录器捕获不到任何修改 research graph 的服务端请求

@req:r447

  规则: compose-create-increments-badge
    当 Lab 已接线 Eden 且当前 activeCount 为 0 时，用户 Compose 创建 Run 成功后任务列表 MUST 包含新 Run 且 badge activeCount MUST 相应增加。

    场景: compose-create-increments-active-badge
      假如 Lab 已接线 Eden 且 MSW mock listRuns 返回空列表（activeCount 为 0）
      当 用户 Compose 创建 Run 成功（researchTasksBadge.compose.test.tsx 经 createResearchRun 并 mutate 任务列表）
      那么 任务列表包含新 Run 且 badge activeCount 从 0 相应增至 1
      而且 badge 以 testid research-tasks-badge 显示 1
  @req:r448

  规则: run-terminal-clears-badge
    当列表中一项 awaiting_confirm 的 Run 经用户 confirm 或 SSE 变为 completed 后，任务列表 status MUST 更新且 badge activeCount MUST 归零。

    场景: terminal-run-clears-badge
      假如 任务列表中存在一项 awaiting_confirm 的 Run
      当 用户 confirm 或 SSE 使其变为 completed
      那么 任务列表中该任务 status 更新为 completed
      而且 badge activeCount 归零
  @req:r449

  规则: cancel-from-header-running
    当 Eden Lab 打开且 Run status 为 running 时，用户从顶栏触发取消并确认后 MUST 调用 POST …/research/:rid/cancel，成功后 Run status MUST 变为 cancelled。

    场景: eden-cancel-invokes-command-port
      假如 Eden Lab 中 Run 状态为 running
      当 用户从顶栏触发取消并确认
      那么 取消经命令口 POST research/:rid/cancel 执行
      而且 Run 状态经 SSE 更新为 cancelled
  @req:r450

  规则: cancel-from-drawer-awaiting-confirm
    当任务抽屉存在 awaiting_confirm 任务时，用户从抽屉行触发取消 MUST 成功，且列表中该任务 status MUST 显示为 cancelled。

    场景: drawer-cancel-awaiting-confirm
      假如 任务抽屉存在 awaiting_confirm 任务
      当 用户从抽屉行触发取消
      那么 取消成功执行
      而且 列表中该任务 status 显示为 cancelled
  @req:r451

  规则: eden-report-not-sessionstorage
    当 sessionStorage 无 labRevisions 时，Eden 报告页 MUST 仍以 Run.report 渲染正文。

    场景: report-renders-without-labrevisions
      假如 sessionStorage 中无 labRevisions
      当 Eden 报告页打开
      那么 报告正文以 Run.report 渲染
      而且 不依赖本地暂存修订
  @req:r452

  规则: eden-export-no-report-error
    当 Eden Run 无 report 时用户触发导出，MUST 展示可见错误提示，且 MUST NOT 写入 fixture revision。

    场景: export-without-report-shows-error
      假如 Eden Run 无 report
      当 用户触发导出
      那么 展示可见错误提示
      而且 不写入 fixture revision
  @req:r453

  规则: drawer-shows-evidence-when-ids-present
    当 Eden Run completed 且某节点 evidenceIds 非空时，打开该节点抽屉 MUST 展示至少一条证据摘要（标题或 snippet 至少其一）。

    场景: drawer-shows-evidence-summary
      假如 Eden Run completed 且某节点 evidenceIds 非空
      当 打开该节点抽屉
      那么 引用列表展示至少一条证据摘要
      而且 标题或 snippet 至少其一可见
  @req:r454

  规则: running-shows-playing
    当 Run status 为 running 时，playing 推断 MUST 为 true，且 MUST NOT 出现「已暂停」类矛盾文案。

    场景: running-playing-inferred
      假如 Run status 为 running
      当 渲染进度横幅与状态文案
      那么 playing 推断为 true
      而且 不出现「已暂停」类矛盾文案
  @req:r455

  规则: convert-node-via-artifact-ref
    Eden 节点抽屉内将节点转为来源时，请求体 MUST 含 ResearchArtifactRef kind=node 与对应 nodeId。

    场景: node-convert-artifact-ref
      假如 用户在 Eden 节点抽屉将节点转为来源
      当 convert-to-source 请求发出
      那么 请求体含 ResearchArtifactRef kind=node 与对应 nodeId
      而且 请求发往对应 research convert 端点
  @req:r456

  规则: evidence-convert-note-calls-api
    Eden 节点抽屉内将已列出证据转为笔记时，请求体 MUST 含 ResearchArtifactRef kind=evidence 与对应 evidenceId，且 MUST 出现成功或失败 toast。

    场景: evidence-convert-note-toast
      假如 用户在 Eden 节点抽屉将已列出证据转为笔记
      当 convert-to-note 请求发出
      那么 请求体含 ResearchArtifactRef kind=evidence 与对应 evidenceId
      而且 成功或失败 toast 出现
  @req:r457

  规则: toast-action-clickable
    共享 toast 以 success 与 action 展示时，用户点击 action 标签 MUST 执行其 onClick（如打开工作区）。

    场景: toast-action-runs-onclick
      假如 共享 toast 以 success 与 action 展示
      当 用户点击 action 标签
      那么 action 的 onClick 被执行
      而且 打开工作区等动作导航生效
  @req:r458

  规则: eden-no-progress-stays-explore
    当 Eden Run 为 running 且尚无 progress 事件时，顶栏相位 MUST 展示基础相位（如 explore），MUST NOT 以节点 phase 众数猜测富化相位。

    场景: no-progress-keeps-base-phase
      假如 Eden Run 为 running 且尚无 progress 事件
      当 顶栏推导相位标签
      那么 相位展示基础相位（如 explore）
      而且 不以节点 phase 众数猜测富化相位
  @req:r459

  规则: slash-compose-prefills-topic
    当用户在工作区 chat 输入带 topic 的深研 slash 并确认发送时，Lab Compose MUST 打开且 topic MUST 预填，MUST NOT 立即创建 ResearchRun。

    场景: slash-prefills-compose-topic
      假如 用户在工作区 chat 输入带 topic 的深研 slash
      当 确认发送
      那么 Lab Compose 打开且 topic 预填
      而且 不立即创建 ResearchRun
  @req:r460

  规则: eden-graph-has-nodes-edges
    P0：Eden Lab 用例 MUST 经稳定锚点（如 research-lab-graph testid）断言画布可见且至少渲染一个研究节点与一条边。

    场景: eden-graph-renders-nodes-edges
      假如 e2e/tests/p0-eden-lab.spec.ts 的 P0 用例进入 Eden Lab 图作业台
      当 以 research-lab-graph testid 定位画布并等待渲染稳定
      那么 断言画布可见且至少渲染一个研究节点与一条边
      而且 断言不依赖脆弱的实现选择器
  @req:r461

  规则: demo-not-registered-in-prod-default
    生产构建未设 VITE_LAB_DEMO 时 /demo/research-lab/* 路由 MUST NOT 注册，请求回落非 Lab 页面或不可达。

    场景: demo-route-unregistered-in-prod
      假如 生产构建未设 VITE_LAB_DEMO
      当 启动应用并请求 /demo/research-lab/* 路由
      那么 该路由未注册
      而且 请求回落非 Lab 页面或不可达
