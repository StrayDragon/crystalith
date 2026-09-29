# language: zh-CN
# capability: workspace-ui-panels
# purpose: 定义 Workspace 业务面板（Sources/Chat/Studio/Research 与引用交互）的最小 UI 契约：面板装配、流式反馈、状态与取消语义、错误可恢复路径。该规范聚焦"用户可观察行为与稳定边界"，不绑定具体组件实现。
# scope: apps/web/src/features/workspace/

功能: workspace-ui-panels

  @req:r398
  规则: Panel composition stays stable with topbar search entry
    Workspace MUST 以稳定的面板集合装配 Sources/Chat/Studio 等能力，并保持各面板的基本区域划分与入口可发现；网搜添来源 MUST 经由顶栏 E1 面板（仅 Fast/直接搜索）发现，而非嵌在来源栏主搜索条；深研主表面入口唯一性约束见 deep-research-ui r99（canonical）。

    场景: panel-composition-stays-stable
      假如 Workspace shell 挂载完成
      当 检查 widgetRegistry 面板集合与顶栏入口
      那么 Sources/Chat/Studio 面板按稳定集合装配
      而且 网搜添来源仅经顶栏 E1 搜索面板发现
  @req:r399
  规则: Streaming UX supports send/chunk/done/error and cancel
    涉及流式输出的面板（如 Chat/Research）MUST 显式呈现 send/chunk/done/error 状态，并 MUST 支持用户取消以停止继续追加内容。

    场景: stream-cancel-stops-appending
      假如 Chat 面板已建立流式对话连接
      当 依次观察 send/chunk/done/error 状态的呈现
      那么 触发取消（AbortController）后流立即停止且不再追加内容
      而且 中途取消不产生尾部的状态回写（reconcile）
  @req:r400
  规则: Chat input supports /prompt directives as user-facing commands
    Workspace 的 Chat 面板 MUST 允许用户在输入框中使用 `/prompt:<preset> <query>` 指令来请求受控的预设生成模式。

    场景: prompt-directive-parsed-in-chat-input
      假如 Chat 输入框就绪
      当 输入 `/prompt:<preset> <query>` 并发送
      那么 指令被解析为受控预设生成请求
      而且 query 部分作为用户问题传递
  @req:r401
  规则: Chat input provides command autocomplete for /prompt presets
    Workspace 的 Chat 输入框 MUST 使用 `GET /v2/commands` 获取命令列表，并在用户输入 `/` 或 `/prompt:` 前缀时提供自动补全 UI。

    场景: prompt-autocomplete-from-commands-list
      假如 Chat 输入框已加载 GET /v2/commands 命令列表
      当 用户输入 `/` 或 `/prompt:` 前缀
      那么 出现按前缀过滤的自动补全 UI
  @req:r402
  规则: System config UI allows users to manage prompt presets
    Workspace UI MUST 提供“系统配置”入口，并允许用户对 custom `/prompt:*` presets 执行 CRUD（触发词、描述、system prompt、启用状态）。

    场景: system-config-manages-custom-presets
      假如 系统配置入口可用
      当 用户对 custom /prompt:* preset 执行增删改与启用切换
      那么 触发词、描述、system prompt 与启用状态被正确提交
  @req:r403
  规则: Chat panel renders plain assistant text plus mounts
    Chat 面板 MUST 将 assistant `message.content` 作为纯文本/markdown 渲染，并 MUST 基于 session `sharedState.ui` 的 mounts 在消息气泡下方渲染结构化 UI（envelope/sharedState 契约见 chat-ui-envelope r28/r29）。

    场景: assistant-content-renders-plain-text-plus-mounts
      假如 assistant 消息含纯文本 content 与 sharedState.ui mounts
      当 Chat 面板渲染该消息
      那么 content 以纯文本/markdown 呈现
      而且 mounts 在消息气泡下方按结构化 UI 渲染
  @req:r404
  规则: Streaming UX applies server-authoritative snapshots and deltas
    当一次对话响应以流式方式生成时，Chat 面板 MUST 使用服务端发送的 `state_snapshot`/`state_delta` 驱动 UI，并以服务端稳定 `messageId` 关联消息与 mounts。

    场景: streaming-applies-server-snapshots-and-deltas
      假如 一次流式对话进行中
      当 服务端发送 state_snapshot 与 state_delta
      那么 面板按服务端权威状态驱动 UI
      而且 消息与 mounts 以服务端稳定 messageId 关联
  @req:r406
  规则: Sources workflows are gated and explicit
    Sources 相关操作 MUST 对来源未就绪/失败等情况显式 gating 并提供可恢复提示；依赖来源的 Studio/结构化生成入口在未选择 ready 来源时可禁用；Chat 发送 MUST NOT 仅因未勾选来源而禁用（未勾选时走 ungrounded QA）。

    场景: sources-gating-stays-explicit
      假如 来源未就绪或失败
      当 打开依赖来源的 Studio/结构化生成入口
      那么 入口显式禁用或给出可恢复提示
      而且 Chat 发送不因未勾选来源被禁用（走 ungrounded QA）
  @req:r407
  规则: Ingestion feedback is queue-based and deterministic
    上传/抓取/搜索等 ingest 操作 MUST 以队列项呈现并可并发显示状态，且每个队列项 MUST 有确定的终态（done/error/cancelled）与重试入口。

    场景: ingestion-queue-items-have-deterministic-terminal-states
      假如 上传/抓取/搜索产生若干 ingest 队列项
      当 并发观察各队列项状态流转
      那么 每项呈现可并发显示的状态
      而且每项到达 done/error/cancelled 确定终态并可重试
  @req:r408
  规则: Sources upload file type support is consistent and includes PDF
    Workspace 的 Sources 上传入口 MUST 支持后端核心发行版的常见内置解析格式，且前端 `accept`、预过滤与提示文案 MUST 保持一致。 该支持集 SHALL 至少包含：`.txt/.md/.markdown` 与 `.pdf`（`application/pdf`），以及 `.csv`（`text/csv`）。

    场景: upload-accepts-pdf-and-csv
      假如 上传控件就绪
      当 检查可接受文件类型与分派逻辑
      那么 PDF 与 CSV 进入对应解析路径
      而且 不支持类型被前端预检拒绝
  @req:r409
  规则: Studio queue, rendering fallback, and export gating are explicit
    Studio MUST 明确展示生成队列状态并支持取消；渲染 MUST 定义确定的回退顺序；导出选项 MUST 仅显示当前输出类型支持项。

    场景: studio-queue-fallback-and-export-gating
      假如 Studio 面板存在生成任务与已渲染输出
      当 观察队列状态、渲染回退与导出选项
      那么 队列状态明确展示且支持取消
      而且 渲染按确定回退顺序降级且导出仅显示当前类型支持项
  @req:r410
  规则: Citation UI distinguishes source count from chunk count
    Chat 引用入口与引用详情弹层 MUST 同时展示唯一来源数与片段（citation/chunk）数，并支持按来源分组或过滤。

    场景: citation-counts-sources-vs-chunks
      假如 引用详情弹层收到一组 citation 片段
      当 citationLabels 按 sourceId（缺失时回退 sourceName）去重统计
      那么 唯一来源数与片段数同时展示
      而且 同一来源的多个 chunk 只计一次来源
  @req:r412
  规则: Frontend MUST provide inline error boundary
    前端 MUST 提供内联错误边界（inline error boundary）渲染组件内错误并允许重试，MUST NOT 白屏。

    场景: inline-error-boundary-renders-and-retries
      假如 某个被边界包裹的组件抛出错误
      当 错误边界捕获
      那么 内联渲染错误并允许重试
      而且 页面不出现白屏
  @req:r414
  规则: Chat panel renders assistant content as streaming-safe markdown
    Chat 面板 SHALL 以流式安全的 markdown 渲染 assistant `message.content`（至少覆盖 GFM 的标题、列表、代码块、表格与引用块），流式中间态（未闭合语法）MUST NOT 破版或以原始围栏字符闪现；user 消息 MUST 保持纯文本渲染。渲染器替换 MUST NOT 改变消息 wire 协议与 sharedState mounts 契约。

    场景: streaming-safe-markdown-rendering
      假如 assistant content 含标题/列表/代码块/表格/引用块且流式未闭合
      当 面板以流式安全 markdown 渲染
      那么 已闭合语法正常渲染且未闭合中间态不破版
      而且 user 消息保持纯文本渲染
  @req:r415
  规则: Sources workflows are gated by ready/error states with actionable recovery
    Sources 栏内每个来源条目 MUST 按状态展示：`ready` 正常（含 source 显示信息）、`failed` 错误信息与可执行恢复提示、`loading`（`processing` 状态的展示别名，等待 embedding/解析完成）旋转指示器且不阻塞其它来源的操作；来源列表条目 MUST 提供“移除”与“重新生成摘要”等操作，且仅当操作真实可用时呈现。

    场景: source-rows-render-status-tones
      假如 来源列表含 ready、processing（含索引进度）与 failed 条目
      当 SourceListRow 按状态渲染
      那么 ready 绿色可选、processing 展示索引中百分比、failed 红色并带错误与恢复信息
      而且 非 ready 条目不可勾选
  @req:r416
  规则: Sources panel MUST expose error snapshot at panel level
    Sources 面板 MUST 在面板层提供错误快照：某来源错误时面板头部或摘要区 SHALL 显示该来源失败总数/错误消息摘要，而不是仅依赖列表项上的小图标。
  
    场景: panel-level-error-snapshot
      假如 Sources 面板打开且存在失败来源或失败上传（SourcesPanel.test 的 r416 用例）
      当 渲染面板
      那么 面板头部出现错误快照条并显示失败总数与首条错误消息摘要
      而且 无任何失败时摘要条完全不渲染

  @req:r418
  规则: URL import dialog hints extractors from pasted URL in fetch mode
    URL 导入对话框在 fetch（获取内容）模式 SHALL 对用户粘贴的 URL 本地匹配 extractors 元数据中的 `urlPatterns`；命中时 SHALL 呈现推荐提取器并默认预选，用户 MUST 能取消或恢复勾选；未命中或未选择时 MUST 以 `extractor: null` 走既有默认提取链；link 模式 MUST NOT 展示任何提取器选择 UI。

    场景: url-dialog-hints-extractor
      假如 用户在 URL 导入对话框 fetch 模式粘贴 URL
      当 matchExtractorsForUrl 以各提取器的 urlPatterns 本地匹配
      那么 命中时呈现推荐提取器并默认预选且可取消勾选
      而且 未命中时以 extractor 为 null 走默认提取链
