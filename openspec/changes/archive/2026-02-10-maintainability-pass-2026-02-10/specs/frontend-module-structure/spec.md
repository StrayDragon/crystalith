## ADDED Requirements

### Requirement: Container/presentation split for complex domain panels
系统 MUST 将复杂 domain panel 的副作用逻辑（数据请求、轮询、取消、重试、状态机）集中在 domain hooks（例如 `useSources`、`useResearch`）中，并将展示逻辑拆为可复用的展示组件，使 UI 组件在给定 props 时尽量保持纯渲染。

#### Scenario: 网络副作用集中在 hook
- **WHEN** 某个 domain panel 需要发起请求并维护加载/错误/分页等状态
- **THEN** 请求与状态管理逻辑位于 domain hook 内
- **AND** 展示组件通过 props 接收数据与回调，不直接在组件体内发起请求

#### Scenario: 大组件可渐进拆分
- **WHEN** 一个 panel/布局组件增长到包含多个可复用 UI 片段（列表、详情、工具条、空状态）
- **THEN** 这些 UI 片段被拆分为独立组件并放入该 domain 的 components 目录
- **AND** 拆分不改变对外导出的 panel 组件接口
