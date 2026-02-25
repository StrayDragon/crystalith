# architecture-plugin-and-agent Specification

## Purpose

定义生成链路的 Agent 与插件扩展契约：图工作流骨架、插件发现与兼容性、类型可扩展边界。

## Non-goals

- 不定义具体输出类型的业务字段
- 不定义部署或 CI 策略

## Requirements

### Requirement: Graph workflow is node-based and typed
生成编排 MUST 使用节点化图工作流并保持状态类型安全。

### Requirement: Agent dependencies are explicit
Agent 运行依赖 MUST 通过显式依赖声明/注入传入，不得隐式读取全局单例。

### Requirement: Plugin discovery uses entry points
插件发现 MUST 通过 `entry_points` 完成；插件注册冲突采用 last-wins。

### Requirement: Plugin compatibility can be gated
系统 SHOULD 支持 `api_version` 或等价兼容性门禁，以避免不兼容插件静默生效。

### Requirement: Plugin schema/render models are importable
插件扩展所需的 schema/render 类型 MUST 可被外部插件稳定导入。
