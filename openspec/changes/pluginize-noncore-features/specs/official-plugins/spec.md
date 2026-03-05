## ADDED Requirements

### Requirement: Official plugins are separately installable packages
官方插件套件 MUST 以独立可安装的 Python 包交付，并通过 `project.entry-points."crystalith.plugins"` 暴露插件 entry points；core MUST NOT 以常规 import 方式静态依赖官方插件实现。

#### Scenario: Core-only install does not pull heavy dependencies
- **WHEN** 运维仅安装 core（不安装任何官方插件包）
- **THEN** 系统 SHALL 仍能启动并提供最小可用能力
- **AND** 启动过程 SHALL 不要求安装 PDF/网页提取/浏览器渲染等重依赖

### Requirement: Official plugin ids follow a stable naming scheme
官方插件 id（即 entry point name、用于 `plugins.enabled/disabled` 的 key）MUST 遵循稳定命名约定，并在文档中保持长期可追溯：

- 输出类型插件：`output-<type>`（例如 `output-quiz`、`output-mindmap`）
- 解析器插件：`parser-<kind>`（例如 `parser-pdf`、`parser-html`）
- 网页提取器插件：`extractor-<kind>`（例如 `extractor-trafilatura`、`extractor-browserless`）

#### Scenario: Operator can enable/disable by plugin id
- **WHEN** 运维在 `config/app.yaml` 中将某个官方插件加入 `plugins.disabled`
- **THEN** 系统 SHALL 跳过加载该插件
- **AND** 诊断信息 SHALL 输出该插件 id 与恢复提示（如何启用/安装）

### Requirement: Official plugins are enabled by default when installed
当未配置 `plugins.enabled`（allowlist）且某官方插件包已安装时，该插件 MUST 默认启用；用户可通过 denylist（`plugins.disabled`）关闭。

#### Scenario: Installed official plugin becomes available without extra config
- **WHEN** 用户安装某个官方插件包且未显式禁用该插件
- **THEN** 系统 SHALL 在启动时加载该插件
- **AND** 对外 API（例如 tools/extractors 列表）SHALL 体现该能力已可用

### Requirement: Official plugin bundles provide a recommended install path
仓库 MUST 提供“core-only”与“official-full（官方插件全量）”的推荐安装方式（依赖组、extras 或等价机制），并明确每个 bundle 覆盖的能力集合。

#### Scenario: Self-host selects an install bundle
- **WHEN** 自托管选择 core-only 或 official-full 安装方式
- **THEN** 文档 SHALL 明确列出可用的输出类型、解析器与网页提取器能力矩阵

### Requirement: Official plugin catalog is maintained for diagnostics
系统 MUST 维护一个“官方插件 catalog”（轻量静态清单，不引入重依赖），用于对外诊断（例如 `/v1/workspace/tools` 的 `diagnostics.official`）与 UI 呈现能力矩阵。

official catalog MUST 包含当前版本定义的**全部官方插件 id**，并至少为每个插件提供：
- `status` 计算所需的信息（loaded/skipped/not_installed）
- 可执行的安装/启用提示（hint），例如推荐的安装 bundle（official-full）或单插件安装方式（如存在）

#### Scenario: Tools diagnostics lists not-installed official plugins
- **WHEN** 系统未安装某些官方插件包
- **THEN** tools 响应的 `diagnostics.official` SHALL 仍包含这些插件 id
- **AND** 其 `status` SHALL 为 `not_installed`
- **AND** SHALL 给出可执行的安装/启用提示
