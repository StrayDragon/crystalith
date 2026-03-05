# workspace-api-contract Specification (Delta)

## MODIFIED Requirements

### Requirement: Workspace tools and outputs endpoints are stable
`/v1/workspace/tools` 与 outputs/slides 相关端点 MUST 保持可用与向后兼容；其中 `/v1/workspace/tools` 的“可用工具集合”允许随已安装/已启用插件变化而变化，但响应形状与字段语义 MUST 稳定。

#### Scenario: Tools endpoint stays compatible while tool set is dynamic
- **WHEN** 前端依赖 `/v1/workspace/tools` 获取工具列表
- **THEN** 系统 SHALL 保持端点可用且字段语义稳定
- **AND** 前端 SHALL 将 tools 列表视为权威来源，不得假设固定枚举集合

## ADDED Requirements

### Requirement: Workspace tools list returns available tools only
`/v1/workspace/tools` 返回的 tools 列表 MUST 仅包含“当前可用”的工具项（可用 = core 内置能力 + 已安装且已启用、并通过兼容性门禁的插件能力）。

#### Scenario: Disabled plugin removes tool but yields diagnostics
- **WHEN** 某输出类型插件被禁用或加载失败
- **THEN** tools 列表 SHALL 不包含该 tool
- **AND** 响应中的 `diagnostics` SHALL 提供结构化诊断信息（error_code/message/hint/details）说明不可用原因与恢复提示

### Requirement: Tools endpoint exposes diagnostics in a machine-readable form
`/v1/workspace/tools` 响应 MUST 暴露 `diagnostics` 字段，用于解释插件能力为什么可用/不可用，并为 UI 与自托管排障提供可执行提示。

`diagnostics` MUST 至少包含：

- `diagnostics.plugins.loaded: string[]`：本次启动加载成功的插件 id 列表
- `diagnostics.plugins.skipped: { [plugin_id: string]: { error_code: string, message: string, hint?: string, details?: object } }`：加载被跳过的插件与稳定 skip detail

为覆盖“官方插件未安装（无 entry point，因此不会出现在 skipped）”的场景，`diagnostics` MUST 额外包含一个轻量的 official catalog（仅字符串/提示，不引入重依赖），用于给出明确的安装/启用指引。

official catalog MUST 覆盖当前版本所定义的**全部官方插件**（不仅是本次迁移涉及的子集），以便 UI 能一致呈现官方能力矩阵与安装指引：

- `diagnostics.official: { [plugin_id: string]: { status: \"loaded\"|\"skipped\"|\"not_installed\", hint?: string, details?: object } }`

#### Scenario: Client renders missing-capability hints
- **WHEN** 客户端收到 tools 响应
- **THEN** 客户端 SHALL 能定位到缺失/禁用/未安装的插件条目
- **AND** SHALL 能将其中的 hint 直接展示为用户可执行的恢复步骤

### Requirement: SLIDES remains a built-in tool in this change
在本变更范围内，`SLIDES` 工具 MUST 仍作为 core 内置能力存在（其工作流插件化由独立变更 `pluginize-slides-workflow` 处理）。

#### Scenario: Core-only profile still exposes slides tool
- **WHEN** 系统仅以 core-only 形态运行（未安装官方插件套件）
- **THEN** `/v1/workspace/tools` 返回的 tools 列表 SHALL 仍包含 `SLIDES`
