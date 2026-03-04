# architecture-plugin-and-agent Specification (Delta)

## ADDED Requirements

### Requirement: OutputTypePlugin may declare frontend_bundle metadata
宿主 MUST 允许 `OutputTypePlugin` 通过稳定共享类型声明可选的 `frontend_bundle` 元数据，以支持插件携带前端交互 UI 渲染器的发现与装配。

#### Scenario: Host accepts OutputTypePlugin.frontend_bundle
- **WHEN** 一个插件实现 `OutputTypePlugin` 且提供 `frontend_bundle`
- **THEN** 宿主 SHALL 校验该值符合共享类型 `FrontendBundleDescriptor`
- **AND** 校验失败时宿主 SHALL 忽略该字段并给出可诊断信息（日志或合规报告）
