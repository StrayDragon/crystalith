## ADDED Requirements

### Requirement: Theme System
工作区 SHALL 支持主题系统，包含浅色、深色和跟随系统三种模式。主题偏好 MUST 持久化到 localStorage。切换主题时 MUST 无页面闪烁。

#### Scenario: 切换到深色模式
- **WHEN** 用户在 WorkspaceHeader 中选择 "深色模式"
- **THEN** 所有组件切换为深色配色，偏好保存到 localStorage

#### Scenario: 跟随系统模式
- **WHEN** 用户选择 "跟随系统" 且操作系统切换到深色模式
- **THEN** 工作区自动切换为深色配色

#### Scenario: 刷新后保持主题
- **WHEN** 用户设置深色模式后刷新页面
- **THEN** 页面直接以深色模式加载，无浅色→深色的闪烁
