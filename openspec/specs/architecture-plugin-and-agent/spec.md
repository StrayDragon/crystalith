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

### Requirement: Plugin compatibility can be gated
系统 MUST 支持 `api_version` 或等价兼容性门禁，以避免不兼容插件静默生效。

#### Scenario: Block incompatible plugin
- **WHEN** 插件声明的兼容版本不满足当前运行时
- **THEN** 系统 SHALL 阻止该插件生效并给出明确原因

### Requirement: Plugin schema/render models are importable
插件扩展所需的 schema/render 类型 MUST 可被外部插件稳定导入。

#### Scenario: Plugin imports shared types
- **WHEN** 外部插件需要引用宿主提供的 schema/render 类型
- **THEN** 这些类型 SHALL 可被稳定导入而不依赖私有实现细节
