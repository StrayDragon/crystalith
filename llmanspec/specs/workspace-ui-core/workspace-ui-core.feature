# language: zh-CN
# capability: workspace-ui-core
# purpose: 定义 Workspace 顶层体验的不变量：模块化布局、头部入口、响应式策略、全局 UX 基线。该规范只覆盖"顶层框架与跨面板约束"，避免与各业务面板的交互细节耦合。
# scope: src/, tests/

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

  @req:r188 @human
  场景: Mobile tab bar respects safe-area and accessibility
    - 移动端 TabBar MUST 兼容 iOS safe-area（home indicator）并满足最小可访问性基线（可聚焦、可读、可识别当前选中项）。

  @req:r219 @human
  场景: Overlay/layer policy is centralized
    - 弹层、对话框、popover 的层级与关闭策略 MUST 统一管理。

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

  @req:r64 @human
  场景: Workspace health status is visible and actionable
    - Workspace MUST 提供可见的健康入口，能展示核心依赖与可选服务的降级信息，并包含可执行的恢复建议。

  @req:r70 @human
  场景: Command palette is discoverable and includes core actions
    - Workspace MUST 提供可发现的命令面板（例如 Ctrl+K）并包含覆盖核心流程的最小动作集；其中与可选能力相关的动作 MUST 随运行时 capability 动态变化。

  @req:workspace-topbar-e1-search-panel @human
  场景: Top bar MUST open E1 anchored search panel
    - 用户点击或聚焦顶栏搜索/调研输入时，Workspace MUST 打开锚定于顶栏的宽幅面板（E1）：面板层级与关闭策略 MUST 走统一 Layer（Esc 与遮罩可关闭）；MUST NOT 使用硬编码 z-index。

  @req:r58 @human
  场景: default-workspace-layout
    - 必须成立：当 用户首次进入 Workspace；那么 系统 SHALL 呈现模块化画布布局，并包含 Sources/Chat/Studio 核心模块的入口
    当 用户首次进入 Workspace
    那么 系统 SHALL 呈现模块化画布布局，并包含 Sources/Chat/Studio 核心模块的入口

  @req:r116 @human
  场景: topbar-shows-search-entry
    - 必须成立：当 用户进入 Workspace 桌面布局；那么 系统 SHALL 在顶部栏中间区域展示可点击的搜索/调研输入入口
    当 用户进入 Workspace 桌面布局
    那么 系统 SHALL 在顶部栏中间区域展示可点击的搜索/调研输入入口

  @req:r153 @human
  场景: mobile-shows-one-main-panel-at-a-time
    - 必须成立：当 视口宽度 < 768px 且用户进入 Workspace；那么 Workspace SHALL 仅展示一个主面板（Sources 或 Chat 或 Studio）
    当 视口宽度 < 768px 且用户进入 Workspace
    那么 Workspace SHALL 仅展示一个主面板（Sources 或 Chat 或 Studio）

  @req:r153 @human
  场景: switching-tabs-preserves-critical-in-progress-state
    - 必须成立：当 用户在 TabBar 之间切换面板；那么 Workspace SHALL 保留用户在关键路径上的进行中状态（例如 Chat 输入草稿、已选择的来源、当前输出列表）
    当 用户在 TabBar 之间切换面板
    那么 Workspace SHALL 保留用户在关键路径上的进行中状态（例如 Chat 输入草稿、已选择的来源、当前输出列表）

  @req:r188 @human
  场景: tab-bar-is-not-obscured-by-home-indicator
    - 必须成立：当 运行环境存在非零 `safe-area-inset-bottom`（例如 iOS Safari）；那么 TabBar SHALL 为交互区域预留底部 padding，使点击目标不被系统 UI 遮挡
    当 运行环境存在非零 `safe-area-inset-bottom`（例如 iOS Safari）
    那么 TabBar SHALL 为交互区域预留底部 padding，使点击目标不被系统 UI 遮挡

  @req:r188 @human
  场景: active-tab-is-accessible
    - 必须成立：当 用户切换到某个面板；那么 TabBar SHALL 标记当前面板为 active（例如通过 `aria-current="page"` 或等价语义）
    当 用户切换到某个面板
    那么 TabBar SHALL 标记当前面板为 active（例如通过 `aria-current="page"` 或等价语义）

  @req:r219 @human
  场景: overlay-close-behavior-is-consistent
    - 必须成立：当 用户打开并关闭对话框/弹层；那么 系统 SHALL 以统一策略处理层级、遮罩与关闭交互（如 Esc/点击遮罩）
    当 用户打开并关闭对话框/弹层
    那么 系统 SHALL 以统一策略处理层级、遮罩与关闭交互（如 Esc/点击遮罩）

  @req:r245 @human
  场景: keyboard-help-is-discoverable
    - 必须成立：当 用户请求查看快捷键帮助；那么 系统 SHALL 提供可访问的帮助入口与最小可用说明
    当 用户请求查看快捷键帮助
    那么 系统 SHALL 提供可访问的帮助入口与最小可用说明

  @req:r263 @human
  场景: default-locale-is-zh-cn-without-a-language-switcher
    - 必须成立：当 用户进入 Workspace 的关键路径；那么 系统 SHALL 使用 `zh-CN` 文案渲染 UI
    当 用户进入 Workspace 的关键路径
    那么 系统 SHALL 使用 `zh-CN` 文案渲染 UI

  @req:r263 @human
  场景: critical-path-copy-is-not-hardcoded-in-components
    - 必须成立：当 开发者为关键路径新增/修改用户可见文案；那么 文案 SHOULD 通过 message key + 字典集中管理，而不是在组件中散落硬编码字符串
    当 开发者为关键路径新增/修改用户可见文案
    那么 文案 SHOULD 通过 message key + 字典集中管理，而不是在组件中散落硬编码字符串

  @req:r274 @human
  场景: panel-interaction-details-are-not-defined-here
    - 必须成立：当 评审者需要了解具体面板的交互契约；那么 系统 SHALL 引导其查阅 `workspace-ui-panels` 而非在本规范中堆叠细节
    当 评审者需要了解具体面板的交互契约
    那么 系统 SHALL 引导其查阅 `workspace-ui-panels` 而非在本规范中堆叠细节

  @req:r281 @human
  场景: no-backend-connection
    - 必须成立：当 前端无法连接后端或连接状态为 error；那么 Workspace SHALL 显示可见的错误提示
    当 前端无法连接后端或连接状态为 error
    那么 Workspace SHALL 显示可见的错误提示

  @req:r281 @human
  场景: notebook-exists-but-has-no-sources
    - 必须成立：当 当前 notebook 下来源列表为空；那么 Workspace SHALL 引导用户上传文件、从 URL 导入或使用搜索导入
    当 当前 notebook 下来源列表为空
    那么 Workspace SHALL 引导用户上传文件、从 URL 导入或使用搜索导入

  @req:r281 @human
  场景: sources-exist-but-no-session-yet
    - 必须成立：当 当前 notebook 已有来源但尚无可用会话；那么 Workspace SHALL 提供"一键开始会话"的明确入口
    当 当前 notebook 已有来源但尚无可用会话
    那么 Workspace SHALL 提供"一键开始会话"的明确入口

  @req:r64 @human
  场景: optional-services-are-degraded
    - 必须成立：当 可选服务（如 chroma/redis/ollama/searxng）处于 degraded/unknown；那么 Workspace SHALL 呈现该状态与 recoveryHint
    当 可选服务（如 chroma/redis/ollama/searxng）处于 degraded/unknown
    那么 Workspace SHALL 呈现该状态与 recoveryHint

  @req:r70 @human
  场景: open-command-palette
    - 必须成立：当 用户触发 Ctrl+K（或等价入口）；那么 系统 SHALL 打开命令面板
    当 用户触发 Ctrl+K（或等价入口）
    那么 系统 SHALL 打开命令面板

  @req:workspace-topbar-e1-search-panel @human
  场景: click-opens-anchored-panel
    - 必须成立：当 用户点击顶栏搜索输入；那么 系统 SHALL 打开锚定顶栏的宽幅面板且可用 Esc 或遮罩关闭
    当 用户点击顶栏搜索输入
    那么 系统 SHALL 打开锚定顶栏的宽幅面板且可用 Esc 或遮罩关闭
