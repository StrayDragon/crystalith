# workspace-api-contract Specification (Delta)

## MODIFIED Requirements

### Requirement: Workspace tools list returns available tools only
`/v1/workspace/tools` 返回的 tools 列表 MUST 仅包含“当前可用”的工具项（可用 = core 内置能力 + 已安装且已启用、并通过兼容性门禁的插件能力）。对于 `SLIDES`，其可用性 MUST 由当前 active `SlidesWorkflowPlugin` 决定，而不是由 core 默认内置。

#### Scenario: Missing or ambiguous slides plugin removes tool and yields diagnostics
- **WHEN** 系统未加载任何可生效的 slides workflow plugin，或同时发现多个候选但未能唯一确定 active plugin
- **THEN** tools 列表 SHALL 不包含 `SLIDES`
- **AND** 响应中的 `diagnostics` SHALL 提供结构化诊断信息（error_code / message / hint / details）说明不可用原因与恢复提示

### Requirement: Tools endpoint exposes diagnostics in a machine-readable form
`/v1/workspace/tools` 响应 MUST 暴露 `diagnostics` 字段，用于解释插件能力为什么可用/不可用，并为 UI 与自托管排障提供可执行提示。

`diagnostics` MUST 至少包含：

- `diagnostics.plugins.loaded: string[]`：本次启动加载成功的插件 id 列表
- `diagnostics.plugins.skipped: { [plugin_id: string]: { error_code: string, message: string, hint?: string, details?: object } }`：加载被跳过的插件与稳定 skip detail

为覆盖“官方插件未安装（无 entry point，因此不会出现在 skipped）”的场景，`diagnostics` MUST 额外包含一个轻量的 official catalog（仅字符串/提示，不引入重依赖），用于给出明确的安装/启用指引。

official catalog MUST 覆盖当前版本所定义的**全部官方插件**，包括官方 slides workflow plugins，以便 UI 能一致呈现官方能力矩阵与安装指引：

- `diagnostics.official: { [plugin_id: string]: { status: "loaded"|"skipped"|"not_installed", hint?: string, details?: object } }`

#### Scenario: Client renders missing-capability hints
- **WHEN** 客户端收到 tools 响应
- **THEN** 客户端 SHALL 能定位到缺失/禁用/未安装的插件条目
- **AND** SHALL 能将其中的 hint 直接展示为用户可执行的恢复步骤
- **AND** 对 `SLIDES` SHALL 能区分“未安装/未启用/未选定 active plugin”等不可用原因

### Requirement: Workspace tools expose a complete config_schema
`/v1/workspace/tools` 返回的工具对象 MUST 包含可直接驱动 UI 的 `config_schema`（如支持主题、数量/难度选项与默认值）。对于 `SLIDES`，该 `config_schema` MUST 覆盖 defaults、quantity / audience / structure / tone / language / density / theme / frontmatter，以及 active plugin 声明的 engine / preview 相关元数据；客户端 MUST NOT 依赖独立 slides config 端点。

#### Scenario: Slides config is derived from tools response only
- **WHEN** 客户端请求 `/v1/workspace/tools`
- **THEN** `SLIDES` tool（若存在） SHALL 在其 `config_schema` 中返回完整配置语义
- **AND** 客户端 SHALL 能仅依赖该响应渲染 slides 配置界面而无需额外请求

## REMOVED Requirements

### Requirement: SLIDES remains a built-in tool in this change
**Reason**: `SLIDES` 已改为由 active `SlidesWorkflowPlugin` 提供，不再默认作为 core 内置能力存在。

**Migration**: 安装并启用官方或自定义 slides workflow plugin；若未安装或无法唯一选定 active plugin，则 `/v1/workspace/tools` 不再返回 `SLIDES`，并通过 `diagnostics` / official catalog 提供安装、启用或选择默认插件的指引。

