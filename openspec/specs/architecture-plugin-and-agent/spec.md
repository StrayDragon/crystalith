# architecture-plugin-and-agent Specification

## Purpose

定义生成链路的 Agent 与插件扩展契约：图工作流骨架、插件发现与兼容性、类型可扩展边界。该规范用于确保内置实现与第三方插件在升级时仍可预测地组合与运行。

## Non-goals

- 不定义具体输出类型的业务字段
- 不定义部署或 CI 策略

## Requirements

### Requirement: Graph workflow is node-based and typed
生成编排 MUST 使用节点化图工作流并保持状态类型安全。

#### Scenario: Build a generation pipeline
- **WHEN** 系统装配一次生成请求的执行流程
- **THEN** 编排 SHALL 以节点化图工作流表达，并保证状态在节点间传递时类型安全

### Requirement: Agent dependencies are explicit
Agent 运行依赖 MUST 通过显式依赖声明/注入传入，不得隐式读取全局单例。

#### Scenario: Inject agent dependencies
- **WHEN** Agent 需要使用外部服务或配置
- **THEN** 依赖 SHALL 通过显式声明与注入提供，而非隐式读取全局单例

### Requirement: Plugin discovery uses entry points
插件发现 MUST 通过 `entry_points` 完成；插件注册冲突采用 last-wins（以“接口 key”为粒度，如 output_type / parser_type / extractor_type），且加载顺序 MUST 可预测：

- 启用插件 MUST 以确定性顺序加载（默认按 `plugin_id` 字典序）。
- 若配置了 `plugins.load_order`，宿主 MUST 按该顺序将对应插件移动到加载序列末尾，使其在冲突裁决中拥有更高优先级。

宿主 MUST 记录每个已注册 key 的“最终生效插件 id/entry point”，以便在 tools / extractors 等对外诊断中解释能力来源与覆盖关系。

#### Scenario: Discover plugins at runtime
- **WHEN** 系统启动并加载可用插件
- **THEN** 插件 SHALL 通过 `entry_points` 被发现
- **AND** 当多个插件声明同一 key 时，系统 SHALL 按 last-wins 规则确定生效项
- **AND** 系统 SHALL 记录生效项对应的 plugin id/entry point 以用于可诊断输出

### Requirement: Plugin enable policy is evaluated before importing plugins
在加载 entry point 对象前，宿主 MUST 先依据 `plugins.enabled/disabled` 判定插件是否启用；被禁用插件 MUST NOT 被 import/初始化，以避免不必要的重依赖与副作用。

#### Scenario: Disabled plugin is skipped without import
- **WHEN** 某插件 id 被 `plugins.disabled` 禁用（或不在 allowlist 中）
- **THEN** 系统 SHALL 跳过该 entry point 的 import 与初始化
- **AND** SHALL 输出结构化诊断信息说明其被禁用与恢复提示

### Requirement: WebExtractorPlugin is supported as a first-class interface
宿主 MUST 支持 `WebExtractorPlugin`（或等价接口）作为一类可被发现与装配的插件接口，并将其与 `OutputTypePlugin` / `ParserPlugin` 一样纳入兼容性门禁与可诊断失败语义。

#### Scenario: Load extractor plugins with compatibility gates
- **WHEN** 系统启动并发现一个实现 `WebExtractorPlugin` 的插件
- **THEN** 系统 SHALL 校验其 `api_version` 与宿主支持集合兼容
- **AND** 兼容时 SHALL 注册为可用提取器实现
- **AND** 不兼容或依赖缺失时 SHALL 跳过并输出稳定 error_code/message/hint

### Requirement: SlidesWorkflowPlugin is supported as a first-class interface
宿主 MUST 将 `SlidesWorkflowPlugin`（或等价接口）作为与 `AIProviderPlugin`、`ParserPlugin`、`OutputTypePlugin`、`WebExtractorPlugin` 并列的一类插件接口，纳入统一的发现、兼容性门禁、启用策略与可诊断失败语义。

#### Scenario: Discover slides workflow plugins at runtime
- **WHEN** 系统启动并扫描 `crystalith.plugins` entry points
- **THEN** 实现 `SlidesWorkflowPlugin` 的插件 SHALL 被识别为 slides workflow 候选
- **AND** SHALL 应用与其他插件一致的 api_version / enablement / load error 校验

### Requirement: Active slides plugin selection is diagnosable
当 slides workflow plugin 的最终生效项无法唯一确定时，宿主 MUST 输出稳定的结构化诊断，而不是静默选择某一个插件。

#### Scenario: Ambiguous slides workflow selection is reported
- **WHEN** 存在多个兼容的 slides workflow plugin 且默认插件未配置
- **THEN** 系统 SHALL 输出稳定 error_code / message / hint / details
- **AND** SHALL 记录候选 plugin id 列表与建议选择方式

### Requirement: Compatibility policy is explicit and stable
宿主 MUST 明确声明支持的 `api_version` 集合，并对不兼容插件实施门禁，避免静默生效或静默失效。

#### Scenario: Block incompatible api_version
- **WHEN** 插件声明的 `api_version` 不在宿主支持集合内
- **THEN** 系统 SHALL 阻止插件生效并输出明确原因

### Requirement: Plugin compatibility failures are diagnosable
当插件因版本不兼容或合规问题被跳过时，系统 MUST 提供结构化、可机器读取的诊断信息。

#### Scenario: Compliance checker reports skipped plugin reason
- **WHEN** 插件被判定为不兼容或不合规而无法加载
- **THEN** 系统 SHALL 在日志或合规报告中给出稳定 `error_code` 与人类可读 `message`
- **AND** SHALL 提供可执行的修复建议（hint）

### Requirement: Plugin schema/render models are importable
插件扩展所需的 schema/render 类型 MUST 可被外部插件稳定导入。

#### Scenario: Plugin imports shared types
- **WHEN** 外部插件需要引用宿主提供的 schema/render 类型
- **THEN** 这些类型 SHALL 可被稳定导入而不依赖私有实现细节

### Requirement: OutputTypePlugin may declare frontend_bundle metadata
宿主 MUST 允许 `OutputTypePlugin` 通过稳定共享类型声明可选的 `frontend_bundle` 元数据，以支持插件携带前端交互 UI 渲染器的发现与装配。

#### Scenario: Host accepts OutputTypePlugin.frontend_bundle
- **WHEN** 一个插件实现 `OutputTypePlugin` 且提供 `frontend_bundle`
- **THEN** 宿主 SHALL 校验该值符合共享类型 `FrontendBundleDescriptor`
- **AND** 校验失败时宿主 SHALL 忽略该字段并给出可诊断信息（日志或合规报告）
