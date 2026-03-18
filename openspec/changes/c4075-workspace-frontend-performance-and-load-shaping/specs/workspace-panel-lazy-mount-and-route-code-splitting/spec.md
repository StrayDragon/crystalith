# workspace-panel-lazy-mount-and-route-code-splitting 规范增量

## ADDED Requirements

### Requirement: Heavy Workspace Panels MUST Mount Lazily
系统 MUST 让重型 workspace panel 按需 mount，而不是在进入 workspace 时一次性全部装载。

#### Scenario: 用户进入 workspace 首屏
- **WHEN** workspace 壳层完成初始装配
- **THEN** 只有 active panel SHALL mount 重组件并启动重请求
- **AND** inactive panel SHALL 保持轻量占位或待机状态

### Requirement: Panel Loading MUST Align with Route-level Code Splitting and Shared Subscriptions
系统 MUST 让 panel 生命周期与 route-level code splitting、共享连接/订阅策略保持一致。

#### Scenario: 用户切换域面板
- **WHEN** 用户切换到新的 workspace domain
- **THEN** 系统 SHALL 按域加载对应 chunk 并启动必要请求
- **AND** SSE、全局诊断或等价共享订阅 SHALL 由壳层集中管理，避免各面板重复创建
