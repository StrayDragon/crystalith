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
