# language: zh-CN
# capability: workspace-ui-panels
# purpose: 定义 Workspace 业务面板（Sources/Chat/Studio/Research 与引用交互）的最小 UI 契约：面板装配、流式反馈、状态与取消语义、错误可恢复路径。该规范聚焦"用户可观察行为与稳定边界"，不绑定具体组件实现。
# scope: src/, tests/

功能: workspace-ui-panels

  @req:r59 @human
  场景: Panel composition stays stable with topbar search entry
    - Workspace MUST 以稳定的面板集合装配 Sources/Chat/Studio 等能力，并保持各面板的基本区域划分与入口可发现；网搜添来源 MUST 经由顶栏 E1 面板（仅 Fast/直接搜索）发现，而非嵌在来源栏主搜索条；深研主表面入口唯一性约束见 deep-research-ui r400（canonical）。

  @req:r117 @human
  场景: Streaming UX supports send/chunk/done/error and cancel
    - 涉及流式输出的面板（如 Chat/Research）MUST 显式呈现 send/chunk/done/error 状态，并 MUST 支持用户取消以停止继续追加内容。

  @req:r154 @human
  场景: Chat input supports /prompt directives as user-facing commands
    - Workspace 的 Chat 面板 MUST 允许用户在输入框中使用 `/prompt:<preset> <query>` 指令来请求受控的预设生成模式。

  @req:r189 @human
  场景: Chat input provides command autocomplete for /prompt presets
    - Workspace 的 Chat 输入框 MUST 使用 `GET /v2/commands` 获取命令列表，并在用户输入 `/` 或 `/prompt:` 前缀时提供自动补全 UI。

  @req:r220 @human
  场景: System config UI allows users to manage prompt presets
    - Workspace UI MUST 提供“系统配置”入口，并允许用户对 custom `/prompt:*` presets 执行 CRUD（触发词、描述、system prompt、启用状态）。

  @req:r246 @human
  场景: Chat panel renders plain assistant text plus mounts
    - Chat 面板 MUST 将 assistant `message.content` 作为纯文本/markdown 渲染，并 MUST 基于 session `sharedState.ui` 的 mounts 在消息气泡下方渲染结构化 UI（envelope/sharedState 契约见 chat-ui-envelope r26/r84）。

  @req:r264 @human
  场景: Streaming UX applies server-authoritative snapshots and deltas
    - 当一次对话响应以流式方式生成时，Chat 面板 MUST 使用服务端发送的 `state_snapshot`/`state_delta` 驱动 UI，并以服务端稳定 `messageId` 关联消息与 mounts。

  @req:r275 @human
  场景: Tool/action cards enforce confirmation and auto-exec whitelist
    - 当消息包含 `tool_use` parts 时，Chat 面板 MUST 仅对宿主白名单内且标记为 `autoExecute=true` 的动作自动执行，对需要确认或非白名单动作 MUST 提供显式确认入口，并对每次执行展示对应 `toolResult` 的结果与错误恢复路径（如允许重试）。

  @req:r282 @human
  场景: Sources workflows are gated and explicit
    - Sources 相关操作 MUST 对来源未就绪/失败等情况显式 gating 并提供可恢复提示；依赖来源的 Studio/结构化生成入口在未选择 ready 来源时可禁用；Chat 发送 MUST NOT 仅因未勾选来源而禁用（未勾选时走 ungrounded QA）。

  @req:r65 @human
  场景: Ingestion feedback is queue-based and deterministic
    - 上传/抓取/搜索等 ingest 操作 MUST 以队列项呈现并可并发显示状态，且每个队列项 MUST 有确定的终态（done/error/cancelled）与重试入口。

  @req:r71 @human
  场景: Sources upload file type support is consistent and includes PDF
    - Workspace 的 Sources 上传入口 MUST 支持后端核心发行版的常见内置解析格式，且前端 `accept`、预过滤与提示文案 MUST 保持一致。 该支持集 SHALL 至少包含：`.txt/.md/.markdown` 与 `.pdf`（`application/pdf`），以及 `.csv`（`text/csv`）。

  @req:r76 @human
  场景: Studio queue, rendering fallback, and export gating are explicit
    - Studio MUST 明确展示生成队列状态并支持取消；渲染 MUST 定义确定的回退顺序；导出选项 MUST 仅显示当前输出类型支持项。

  @req:r283 @human
  场景: Citation UI distinguishes source count from chunk count
    - Chat 引用入口与引用详情弹层 MUST 同时展示唯一来源数与片段（citation/chunk）数，并支持按来源分组或过滤。

  @req:sources-bar-tab-model @human
  场景: Sources bar MUST use tabs (all/selected/history) with cross-tab enforcement
    - Sources 栏 MUST 使用 all/selected/history 三个 tab（默认 all），tab 间状态联动 MUST 遵守：拖动/添加/移除来源只允许在 all tab 发生；selected 计数 MUST 基于 `selectedSourceIds` 动态计算；history 仅记录最近 upload/import/query 动作且 MUST NOT 作为选择来源的渠道，将历史条目添加回来源栏 SHOULD 支持（该动作仅更新来源栏视图，不触发后端搜索）；sources 列表滚动 MUST 由独立 scroll 状态管理。

  @req:frontend-inline-error-boundary @human
  场景: Frontend MUST provide inline error boundary
    - 前端 MUST 提供内联错误边界（inline error boundary）渲染组件内错误并允许重试，MUST NOT 白屏。

  @req:frontend-message-status-from-fetcher @human
  场景: Frontend MUST derive message status from fetcher/session snapshot
    - 前端消息气泡状态（pending/streaming/done/error）MUST 派生自 fetcher/session snapshot 而非本地临时布尔标记，以保证多 tab 一致性与重连语义。

  @req:workspace-sources-bar-gating @human
  场景: Sources workflows are gated by ready/error states with actionable recovery
    - Sources 栏内每个来源条目 MUST 按状态展示：`ready` 正常（含 source 显示信息）、`failed` 错误信息与可执行恢复提示、`loading`（`processing` 状态的展示别名，等待 embedding/解析完成）旋转指示器且不阻塞其它来源的操作；来源列表条目 MUST 提供“移除”与“重新生成摘要”等操作，且仅当操作真实可用时呈现。

  @req:workspace-sources-panel-error-snapshot @human
  场景: Sources panel MUST expose error snapshot at panel level
    - Sources 面板 MUST 在面板层提供错误快照：某来源错误时面板头部或摘要区 SHALL 显示该来源失败总数/错误消息摘要，而不是仅依赖列表项上的小图标。

  @req:workspace-sources-drag-drop-add @human
  场景: Sources drag-and-drop MUST add to source list without upload
    - 将文件拖入 Sources 栏/面板非上传区时，系统 MUST 仅把该文件加入来源列表（等待后续上传或转换为可检索来源），MUST NOT 自动触发上传或解析。
