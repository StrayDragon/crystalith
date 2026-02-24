# workspace-ui-core Specification

## Purpose

定义 Workspace 顶层体验的不变量：模块化布局、头部入口、响应式策略、全局 UX 基线。

## Non-goals

- 不重复 Sources/Chat/Studio/Analysis 子域细节
- 不定义后端算法

## Requirements

### Requirement: Workspace uses modular canvas layout
工作区 MUST 基于模块化画布布局，默认包含 Sources/Chat/Studio 核心模块。

### Requirement: Header remains compact and functional
顶部栏 MUST 提供 notebook 切换、布局锁定、全局入口，窄屏下仍可访问。

### Requirement: Overlay/layer policy is centralized
弹层、对话框、popover 的层级与关闭策略 MUST 统一管理。

### Requirement: Keyboard and accessibility baselines exist
快捷键帮助、基础可访问性与 modal 交互规范 MUST 提供。

### Requirement: Core panel contracts are delegated
Sources/Chat/Studio/Analysis 细节 MUST 在专门 UI 规范维护，避免总览规范膨胀。
