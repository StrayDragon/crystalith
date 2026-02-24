# workspace-ui-studio Specification

## Purpose

定义 Studio 模块交互：工具目录、配置对话、生成队列、取消重试、导出与渲染回退策略。

## Non-goals

- 不定义每个输出类型的内容语义
- 不定义底层生成算法实现细节

## Requirements

### Requirement: Studio composition is stable
Studio MUST 提供输出历史/队列、添加笔记入口、工具生成入口。

### Requirement: Generation is gated by selected sources
当未选择来源时，生成动作 MUST 禁用并展示明确提示。

### Requirement: Tool catalog and config are backend-driven
工具目录与配置 MUST 来自 workspace tools API，用户配置约束需传递到后端请求。

### Requirement: Preference propagation is consistent
生成倾向 preference MUST 在创建与重试时一致传递。

### Requirement: Queue status and cancellation semantics are explicit
队列状态至少覆盖 `queued/running/done/error/cancelled`，取消后不得产生半成品持久化。

### Requirement: Rendering priority and export gating are deterministic
渲染优先级 MUST 为 专用插件 > 通用渲染 > 原始 JSON；导出格式仅显示当前类型支持项。
