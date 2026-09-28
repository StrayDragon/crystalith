# language: zh-CN
# capability: workspace-ui-core
# purpose: 定义 Workspace 顶层体验的不变量：模块化布局、头部入口、响应式策略、全局 UX 基线。该规范只覆盖"顶层框架与跨面板约束"，避免与各业务面板的交互细节耦合。
# scope: apps/web/src/features/workspace/

功能: workspace-ui-core

  @req:r386
  规则: Workspace uses modular canvas layout
    工作区 MUST 基于模块化画布布局，默认包含 Sources/Chat/Studio 核心模块。

    场景: workspace-shell-mounts-core-modules
      假如 打开 Workspace 页面
      那么 workspace 根容器与顶栏可见
      而且 Sources、Chat、Studio 三个核心模块面板同时挂载可见
  @req:r387
  规则: Header remains compact and hosts search entry
    顶部栏 MUST 提供 notebook 切换、布局锁定、全局入口，并 MUST 在中间区域提供统一的搜索/调研输入入口；窄屏下关键入口仍可访问。

    场景: topbar-hosts-core-entries
      假如 Workspace 顶栏挂载完成
      那么 notebook 切换器与布局锁定开关等关键入口可见
      而且 顶栏中间的搜索/调研输入入口可见，点击后打开搜索面板
  @req:r388
  规则: Mobile viewport uses single-panel navigation
    当视口宽度处于移动端窄屏范围时（以 `md` 断点为界），Workspace MUST 以单面板模式呈现 Sources / Chat / Studio，并通过底部 TabBar 提供面板切换入口，以避免多列挤压造成不可用。

    场景: mobile-viewport-renders-single-panel-tabbar
      假如 视口宽度处于移动端窄屏（md 断点以下）
      当 Workspace 渲染 Sources/Chat/Studio
      那么 以单面板模式呈现并通过底部 TabBar 提供切换入口
  @req:r471

  规则: switching-tabs-preserves-critical-in-progress-state
    当用户在 TabBar 之间切换面板时，Workspace SHALL 保留用户在关键路径上的进行中状态（例如 Chat 输入草稿、已选择的来源、当前输出列表）。

    场景: switching-tabs-preserves-in-progress-state
      假如 某面板存在进行中状态（流式回复/输入草稿/已选来源）
      当 用户切换到其它面板再返回
      那么 关键进行中状态保留不丢失
  @req:r389
  规则: Mobile tab bar respects safe-area and accessibility
    移动端 TabBar MUST 兼容 iOS safe-area（home indicator）并满足最小可访问性基线（可聚焦、可读、可识别当前选中项）。

    场景: tabbar-safe-area-and-accessibility
      假如 移动端 TabBar 渲染于 iOS safe-area 环境
      当 检查底部 padding 与可访问性基线
      那么 避让 home indicator 且可聚焦、可读、可识别当前选中项
  @req:r472

  规则: tab-bar-is-not-obscured-by-home-indicator
    当运行环境存在非零 `safe-area-inset-bottom`（例如 iOS Safari）时，TabBar MUST 为交互区域预留底部 padding，使点击目标不被系统 UI 遮挡。

    场景: tabbar-not-obscured-by-home-indicator
      假如 TabBar 渲染于带非零 safe-area-inset-bottom 的视口
      当 测量交互区域底部布局
      那么 点击目标不被系统 UI 遮挡
  @req:r390
  规则: Overlay/layer policy is centralized
    弹层、对话框、popover 的层级、遮罩与关闭交互（如 Esc/点击遮罩关闭）MUST 由统一策略管理。
  @req:r391
  规则: Keyboard and accessibility baselines exist
    快捷键帮助、基础可访问性与 modal 交互规范 MUST 提供。

    场景: keyboard-shortcuts-and-help-baseline
      假如 Workspace shell 已挂载
      当 用户在非输入焦点按下注册的全局快捷键
      那么 对应动作被触发，输入框聚焦时全局快捷键被忽略（Ctrl+K 等 allowInInput 例外仍可用）
      而且 用户菜单中的快捷键帮助入口可打开快捷键帮助面板
  @req:r392
  规则: Workspace localization is centralized and locale-ready (zh-CN only)
    Workspace MUST 将关键路径的用户可见文案集中管理（稳定 message key + `t()` 等价接口），并默认使用 `zh-CN` 文案。核心发行版不要求提供语言切换入口与多语言内置翻译，但结构 SHOULD 保持可扩展以支持社区后续新增 locale。

    场景: user-facing-copy-centralized-via-message-keys
      假如 Workspace 关键路径文案就绪
      当 检查用户可见文案来源
      那么 文案经稳定 message key 集中管理且默认 zh-CN
  @req:r393
  规则: Core panel contracts are delegated
    Sources/Chat/Studio/Research 等面板交互细节 MUST 在 `workspace-ui-panels` 规范维护，避免总览规范膨胀。
  @req:r394
  规则: Workspace provides guided empty states
    Workspace MUST 在首次进入与关键空态下提供分层引导，明确下一步动作与成功路径。

    场景: guided-empty-states
      当 computeWorkspaceReadiness 依据连接、notebook、来源与会话状态求值
      那么 每个关键空态（未连接、无 notebook、来源加载中、无会话）都映射到对应的引导状态而非空白
      而且 引导状态明确下一步动作与成功路径
  @req:r473

  规则: Empty states enumerate backend loss, empty sources, and missing session
    Workspace MUST 对关键空态提供分层引导并明确下一步动作：后端不可连接或连接状态为 error 时 SHALL 显示可见的错误提示；当前 notebook 来源列表为空时 SHALL 引导用户上传文件、从 URL 导入或使用搜索导入；已有来源但尚无可用会话时 SHALL 提供“一键开始会话”的明确入口。

    场景: empty-states-enumerate-error-empty-sources-no-session
      当 computeWorkspaceReadiness 求值出连接错误、来源为空与已有来源无会话状态
      那么 连接错误映射到可见的错误提示状态
      而且 来源为空时给出上传/URL 导入/搜索导入引导，已有来源无会话时给出一键开始会话入口
  @req:r395
  规则: Workspace health status is visible and actionable
    Workspace MUST 提供可见的健康入口，能展示核心依赖与可选服务（如 chroma/redis/ollama/searxng）的 degraded/unknown 状态与恢复提示（recoveryHint），并包含可执行的恢复建议。

    场景: health-status-visible-and-actionable
      当 用户菜单打开诊断面板
      那么 核心依赖与 chroma/redis/ollama/searxng 等可选服务状态可见
      而且 degraded/unknown 服务附带 recoveryHint 恢复建议，诊断数据可经 force 端点强制刷新
  @req:r396
  规则: Command palette is discoverable and includes core actions
    Workspace MUST 提供可发现的命令面板（例如 Ctrl+K）并包含覆盖核心流程的最小动作集；其中与可选能力相关的动作 MUST 随运行时 capability 动态变化。

    场景: command-palette-discoverable
      假如 工作区 shell 挂载完成
      当 用户按下 Ctrl+K
      那么 命令面板打开且可检索命令
  @req:r397
  规则: Top bar MUST open E1 anchored search panel
    用户点击或聚焦顶栏搜索/调研输入时，Workspace MUST 打开锚定于顶栏的宽幅面板（E1）：面板层级与关闭策略 MUST 走统一 Layer（Esc 与遮罩可关闭）；MUST NOT 使用硬编码 z-index。

    场景: topbar-search-opens-anchored-panel
      当 用户点击或聚焦顶栏搜索/调研输入入口
      那么 锚定顶栏的宽幅搜索面板（E1）打开且包含来源搜索输入与提交动作
      而且 面板层级与关闭走统一 Layer，Esc 与遮罩可关闭且不硬编码 z-index
