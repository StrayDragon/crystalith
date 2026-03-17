# command-palette-action-surface-and-contextual-shortcuts 规范增量

## ADDED Requirements

### Requirement: Command Palette MUST Be Built from a Shared Action Registry
系统 MUST 让 command palette 建立在共享 action registry 之上，而不是手写一份独立动作列表。

#### Scenario: 用户打开 command palette 搜索动作
- **WHEN** palette 渲染可执行动作
- **THEN** 动作 SHALL 来自统一 registry
- **AND** panel、widget、plugin 与 global actions SHALL 使用同一注册机制

### Requirement: Contextual Shortcuts MUST Respect the Same Availability Semantics as Palette Actions
系统 MUST 让 contextual shortcuts 与 palette actions 共享同一可见性和可执行条件，而不是各自绕过状态判断。

#### Scenario: 用户在某个 selection 上使用快捷键
- **WHEN** 某个 action 通过快捷键或 context action 触发
- **THEN** 系统 SHALL 使用与 palette 相同的 enabled_when / scope 语义
- **AND** SHALL 保证快捷入口和搜索入口不会对同一动作给出冲突状态
