# language: zh-CN
# capability: workspace-ui-core
# purpose: 定义 Workspace 顶层体验的不变量：模块化布局、头部入口、响应式策略、全局 UX 基线。该规范只覆盖"顶层框架与跨面板约束"，避免与各业务面板的交互细节耦合。
# scope: apps/web/src/features/workspace/

功能: workspace-ui-core

  @req:r58 @human
  场景: Workspace uses modular canvas layout
    - 工作区 MUST 基于模块化画布布局，默认包含 Sources/Chat/Studio 核心模块。

  @req:r116 @human
  场景: Header remains compact and hosts search entry
    - 顶部栏 MUST 提供 notebook 切换、布局锁定、全局入口，并 MUST 在中间区域提供统一的搜索/调研输入入口；窄屏下关键入口仍可访问。

  @req:r153 @human
  场景: Mobile viewport uses single-panel navigation
    - 当视口宽度处于移动端窄屏范围时（以 `md` 断点为界），Workspace MUST 以单面板模式呈现 Sources / Chat / Studio，并通过底部 TabBar 提供面板切换入口，以避免多列挤压造成不可用。

  @req:r153 @human
  场景: switching-tabs-preserves-critical-in-progress-state
    - 当用户在 TabBar 之间切换面板时，Workspace SHALL 保留用户在关键路径上的进行中状态（例如 Chat 输入草稿、已选择的来源、当前输出列表）。

  @req:r188 @human
  场景: Mobile tab bar respects safe-area and accessibility
    - 移动端 TabBar MUST 兼容 iOS safe-area（home indicator）并满足最小可访问性基线（可聚焦、可读、可识别当前选中项）。

  @req:r188 @human
  场景: tab-bar-is-not-obscured-by-home-indicator
    - 当运行环境存在非零 `safe-area-inset-bottom`（例如 iOS Safari）时，TabBar MUST 为交互区域预留底部 padding，使点击目标不被系统 UI 遮挡。

  @req:r219 @human
  场景: Overlay/layer policy is centralized
    - 弹层、对话框、popover 的层级、遮罩与关闭交互（如 Esc/点击遮罩关闭）MUST 由统一策略管理。

  @req:r245 @human
  场景: Keyboard and accessibility baselines exist
    - 快捷键帮助、基础可访问性与 modal 交互规范 MUST 提供。

  @req:r263 @human
  场景: Workspace localization is centralized and locale-ready (zh-CN only)
    - Workspace MUST 将关键路径的用户可见文案集中管理（稳定 message key + `t()` 等价接口），并默认使用 `zh-CN` 文案。核心发行版不要求提供语言切换入口与多语言内置翻译，但结构 SHOULD 保持可扩展以支持社区后续新增 locale。

  @req:r274 @human
  场景: Core panel contracts are delegated
    - Sources/Chat/Studio/Research 等面板交互细节 MUST 在 `workspace-ui-panels` 规范维护，避免总览规范膨胀。

  @req:r281 @human
  场景: Workspace provides guided empty states
    - Workspace MUST 在首次进入与关键空态下提供分层引导，明确下一步动作与成功路径。

  @req:r281 @human
  场景: Empty states enumerate backend loss, empty sources, and missing session
    - Workspace MUST 对关键空态提供分层引导并明确下一步动作：后端不可连接或连接状态为 error 时 SHALL 显示可见的错误提示；当前 notebook 来源列表为空时 SHALL 引导用户上传文件、从 URL 导入或使用搜索导入；已有来源但尚无可用会话时 SHALL 提供“一键开始会话”的明确入口。

  @req:r64 @human
  场景: Workspace health status is visible and actionable
    - Workspace MUST 提供可见的健康入口，能展示核心依赖与可选服务（如 chroma/redis/ollama/searxng）的 degraded/unknown 状态与恢复提示（recoveryHint），并包含可执行的恢复建议。

  @req:r70 @human
  场景: Command palette is discoverable and includes core actions
    - Workspace MUST 提供可发现的命令面板（例如 Ctrl+K）并包含覆盖核心流程的最小动作集；其中与可选能力相关的动作 MUST 随运行时 capability 动态变化。

  @req:workspace-topbar-e1-search-panel @human
  场景: Top bar MUST open E1 anchored search panel
    - 用户点击或聚焦顶栏搜索/调研输入时，Workspace MUST 打开锚定于顶栏的宽幅面板（E1）：面板层级与关闭策略 MUST 走统一 Layer（Esc 与遮罩可关闭）；MUST NOT 使用硬编码 z-index。
