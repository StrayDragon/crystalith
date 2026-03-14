# workspace-ui-core 规范增量

## ADDED Requirements

### Requirement: Mobile viewport uses single-panel navigation
当视口宽度处于移动端窄屏范围时（以 `md` 断点为界），Workspace MUST 以单面板模式呈现 Sources / Chat / Studio，并通过底部 TabBar 提供面板切换入口，以避免多列挤压造成不可用。

#### Scenario: Mobile shows one main panel at a time
- **WHEN** 视口宽度 < 768px 且用户进入 Workspace
- **THEN** Workspace SHALL 仅展示一个主面板（Sources 或 Chat 或 Studio）
- **AND** Workspace SHALL 提供可见的 TabBar 用于切换主面板

#### Scenario: Switching tabs preserves critical in-progress state
- **WHEN** 用户在 TabBar 之间切换面板
- **THEN** Workspace SHALL 保留用户在关键路径上的进行中状态（例如 Chat 输入草稿、已选择的来源、当前输出列表）
- **AND** 切换不应触发“等价于刷新页面”的状态清空

### Requirement: Mobile tab bar respects safe-area and accessibility
移动端 TabBar MUST 兼容 iOS safe-area（home indicator）并满足最小可访问性基线（可聚焦、可读、可识别当前选中项）。

#### Scenario: Tab bar is not obscured by home indicator
- **WHEN** 运行环境存在非零 `safe-area-inset-bottom`（例如 iOS Safari）
- **THEN** TabBar SHALL 为交互区域预留底部 padding，使点击目标不被系统 UI 遮挡

#### Scenario: Active tab is accessible
- **WHEN** 用户切换到某个面板
- **THEN** TabBar SHALL 标记当前面板为 active（例如通过 `aria-current="page"` 或等价语义）
