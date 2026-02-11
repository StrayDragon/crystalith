## MODIFIED Requirements

### Requirement: Workspace domain slicing
系统 MUST 在 workspace 子域目录内组织相关代码，每个功能域（来源、对话、Studio 等）有清晰的模块边界。

#### Scenario: 各功能域可独立注册为 widget
- **WHEN** 模块化布局需要注册 widget
- **THEN** 每个功能域 MUST 导出可独立渲染的 widget 入口组件
- **AND** widget 入口组件封装该域的所有交互逻辑

### Requirement: GridStack 桥接层
系统 MUST 提供 GridStack 与 React 的桥接层，管理 widget 的生命周期、DOM 同步和 portal 渲染。

#### Scenario: Widget 注册与渲染
- **WHEN** 一个 widget 被添加到画布
- **THEN** 桥接层 MUST 在 GridStack 创建的 DOM 容器中通过 React Portal 渲染对应的 React 组件
- **AND** React 组件的生命周期与 GridStack widget 生命周期同步

#### Scenario: Widget 移除与清理
- **WHEN** 一个 widget 从画布移除
- **THEN** 桥接层 MUST 清理对应的 React Portal 和组件状态
