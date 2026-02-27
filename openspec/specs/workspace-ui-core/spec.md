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
Workspace MUST 提供可发现的命令面板（例如 Ctrl+K）并包含覆盖核心流程的最小动作集。

#### Scenario: Open command palette
- **WHEN** 用户触发 Ctrl+K（或等价入口）
- **THEN** 系统 SHALL 打开命令面板
- **AND** 至少包含：创建/切换 notebook、导入来源、开始会话、打开 Studio/Slides、打开诊断
