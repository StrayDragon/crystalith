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
插件发现 MUST 通过 `entry_points` 完成；插件注册冲突采用 last-wins。

#### Scenario: Discover plugins at runtime
- **WHEN** 系统启动并加载可用插件
- **THEN** 插件 SHALL 通过 `entry_points` 被发现，且冲突时按 last-wins 规则确定生效项

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
