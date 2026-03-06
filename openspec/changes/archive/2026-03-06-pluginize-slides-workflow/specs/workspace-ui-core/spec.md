# workspace-ui-core Specification (Delta)

## MODIFIED Requirements

### Requirement: Command palette is discoverable and includes core actions
Workspace MUST 提供可发现的命令面板（例如 Ctrl+K）并包含覆盖核心流程的最小动作集；其中与可选能力相关的动作 MUST 随运行时 capability 动态变化。

#### Scenario: Open command palette
- **WHEN** 用户触发 Ctrl+K（或等价入口）
- **THEN** 系统 SHALL 打开命令面板
- **AND** 至少包含：创建/切换 notebook、导入来源、开始会话、打开 Studio、打开诊断
- **AND** 仅当 `/v1/workspace/tools` 返回 `SLIDES` 时才包含“打开 Slides”动作

## ADDED Requirements

### Requirement: Slides entry points follow runtime capability
Workspace 中的 slides 入口（如 onboarding、快捷按钮、Studio tool cards）MUST 跟随运行时 capability，而不是默认显示为可用。

#### Scenario: Missing slides capability shows guidance instead of a broken entry
- **WHEN** `/v1/workspace/tools` 未返回 `SLIDES`，且 diagnostics / official catalog 提供 slides 相关恢复提示
- **THEN** 客户端 SHALL 不渲染可直接打开的 slides 入口
- **AND** SHALL 提供打开诊断或复制安装/启用提示的替代入口
