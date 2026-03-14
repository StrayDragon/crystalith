# workspace-ui-core Specification

## Purpose

定义 Workspace 顶层体验的不变量：模块化布局、头部入口、响应式策略、全局 UX 基线。该规范只覆盖“顶层框架与跨面板约束”，避免与各业务面板的交互细节耦合。

## Non-goals

- 不重复 Sources/Chat/Studio/Analysis 子域细节
- 不定义后端算法
## Requirements
### Requirement: Workspace uses modular canvas layout
工作区 MUST 基于模块化画布布局，默认包含 Sources/Chat/Studio 核心模块。

#### Scenario: Default workspace layout
- **WHEN** 用户首次进入 Workspace
- **THEN** 系统 SHALL 呈现模块化画布布局，并包含 Sources/Chat/Studio 核心模块的入口

### Requirement: Header remains compact and functional
顶部栏 MUST 提供 notebook 切换、布局锁定、全局入口，窄屏下仍可访问。

#### Scenario: Narrow screen header remains usable
- **WHEN** 视口宽度收窄到移动端尺寸
- **THEN** 顶部栏 SHALL 仍可完成 notebook 切换与关键入口访问

### Requirement: Mobile viewport uses single-panel navigation
当视口宽度处于移动端窄屏范围时（以 `md` 断点为界），Workspace MUST 以单面板模式呈现 Sources / Chat / Studio，并通过底部 TabBar 提供面板切换入口，以避免多列挤压造成不可用。

#### Scenario: Mobile shows one main panel at a time
- **WHEN** 视口宽度 < 768px 且用户进入 Workspace
- **THEN** Workspace SHALL 仅展示一个主面板（Sources 或 Chat 或 Studio）
- **AND** Workspace SHALL 提供可见的 TabBar 用于切换主面板

#### Scenario: Switching tabs preserves critical in-progress state
- **WHEN** 用户在 TabBar 之间切换面板
- **THEN** Workspace SHALL 保留用户在关键路径上的进行中状态（例如 Chat 输入草稿、已选择的来源、当前输出列表）
- **AND** 切换不应触发“等价于刷新页面”的状态清空

### Requirement: Mobile tab bar respects safe-area and accessibility
移动端 TabBar MUST 兼容 iOS safe-area（home indicator）并满足最小可访问性基线（可聚焦、可读、可识别当前选中项）。

#### Scenario: Tab bar is not obscured by home indicator
- **WHEN** 运行环境存在非零 `safe-area-inset-bottom`（例如 iOS Safari）
- **THEN** TabBar SHALL 为交互区域预留底部 padding，使点击目标不被系统 UI 遮挡

#### Scenario: Active tab is accessible
- **WHEN** 用户切换到某个面板
- **THEN** TabBar SHALL 标记当前面板为 active（例如通过 `aria-current="page"` 或等价语义）

### Requirement: Overlay/layer policy is centralized
弹层、对话框、popover 的层级与关闭策略 MUST 统一管理。

#### Scenario: Overlay close behavior is consistent
- **WHEN** 用户打开并关闭对话框/弹层
- **THEN** 系统 SHALL 以统一策略处理层级、遮罩与关闭交互（如 Esc/点击遮罩）

### Requirement: Keyboard and accessibility baselines exist
快捷键帮助、基础可访问性与 modal 交互规范 MUST 提供。

#### Scenario: Keyboard help is discoverable
- **WHEN** 用户请求查看快捷键帮助
- **THEN** 系统 SHALL 提供可访问的帮助入口与最小可用说明

### Requirement: Workspace localization is centralized and locale-ready (zh-CN only)
Workspace MUST 将关键路径的用户可见文案集中管理（稳定 message key + `t()` 等价接口），并默认使用 `zh-CN` 文案。核心发行版不要求提供语言切换入口与多语言内置翻译，但结构 SHOULD 保持可扩展以支持社区后续新增 locale。

#### Scenario: Default locale is zh-CN without a language switcher
- **WHEN** 用户进入 Workspace 的关键路径
- **THEN** 系统 SHALL 使用 `zh-CN` 文案渲染 UI
- **AND** UI 不要求提供语言切换入口

#### Scenario: Critical-path copy is not hardcoded in components
- **WHEN** 开发者为关键路径新增/修改用户可见文案
- **THEN** 文案 SHOULD 通过 message key + 字典集中管理，而不是在组件中散落硬编码字符串

### Requirement: Core panel contracts are delegated
Sources/Chat/Studio/Analysis 等面板交互细节 MUST 在 `workspace-ui-panels` 规范维护，避免总览规范膨胀。

#### Scenario: Panel interaction details are not defined here
- **WHEN** 评审者需要了解具体面板的交互契约
- **THEN** 系统 SHALL 引导其查阅 `workspace-ui-panels` 而非在本规范中堆叠细节

### Requirement: Workspace provides guided empty states
Workspace MUST 在首次进入与关键空态下提供分层引导，明确下一步动作与成功路径。

#### Scenario: No backend connection
- **WHEN** 前端无法连接后端或连接状态为 error
- **THEN** Workspace SHALL 显示可见的错误提示
- **AND** 提供“重试连接/查看诊断/打开部署文档”的可操作入口

#### Scenario: Notebook exists but has no sources
- **WHEN** 当前 notebook 下来源列表为空
- **THEN** Workspace SHALL 引导用户上传文件、从 URL 导入或使用搜索导入

#### Scenario: Sources exist but no session yet
- **WHEN** 当前 notebook 已有来源但尚无可用会话
- **THEN** Workspace SHALL 提供“一键开始会话”的明确入口

### Requirement: Workspace health status is visible and actionable
Workspace MUST 提供可见的健康入口，能展示核心依赖与可选服务的降级信息，并包含可执行的恢复建议。

#### Scenario: Optional services are degraded
- **WHEN** 可选服务（如 chroma/redis/ollama/searxng）处于 degraded/unknown
- **THEN** Workspace SHALL 呈现该状态与 recovery_hint
- **AND** 用户 SHALL 能在 UI 中一键复制/跳转到对应修复说明

### Requirement: Command palette is discoverable and includes core actions
Workspace MUST 提供可发现的命令面板（例如 Ctrl+K）并包含覆盖核心流程的最小动作集；其中与可选能力相关的动作 MUST 随运行时 capability 动态变化。

#### Scenario: Open command palette
- **WHEN** 用户触发 Ctrl+K（或等价入口）
- **THEN** 系统 SHALL 打开命令面板
- **AND** 至少包含：创建/切换 notebook、导入来源、开始会话、打开 Studio、打开诊断
- **AND** 仅当 `/v1/workspace/tools` 返回 `SLIDES` 时才包含“打开 Slides”动作

### Requirement: Slides entry points follow runtime capability
Workspace 中的 slides 入口（如 onboarding、快捷按钮、Studio tool cards）MUST 跟随运行时 capability，而不是默认显示为可用。

#### Scenario: Missing slides capability shows guidance instead of a broken entry
- **WHEN** `/v1/workspace/tools` 未返回 `SLIDES`，且 diagnostics / official catalog 提供 slides 相关恢复提示
- **THEN** 客户端 SHALL 不渲染可直接打开的 slides 入口
- **AND** SHALL 提供打开诊断或复制安装/启用提示的替代入口
