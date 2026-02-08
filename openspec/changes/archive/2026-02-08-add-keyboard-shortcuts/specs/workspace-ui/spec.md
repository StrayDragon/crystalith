## ADDED Requirements

### Requirement: Keyboard Shortcut System
工作区 SHALL 提供全局键盘快捷键系统。快捷键 MUST 在输入框获得焦点时自动禁用（避免冲突）。系统 SHALL 提供快捷键帮助面板。

#### Scenario: 全局搜索快捷键
- **WHEN** 用户按下 Ctrl+K（焦点不在输入框）
- **THEN** 打开搜索/命令面板

#### Scenario: 输入框焦点时忽略全局快捷键
- **WHEN** 用户在消息输入框中按下 Ctrl+K
- **THEN** 不触发全局搜索，Ctrl+K 被输入框正常处理

#### Scenario: 快捷键帮助面板
- **WHEN** 用户按下 Ctrl+?
- **THEN** 显示所有可用快捷键的分类列表

### Requirement: Panel Navigation Shortcuts
用户 SHALL 能通过键盘快捷键在面板间导航。

#### Scenario: 面板切换
- **WHEN** 用户按下 Ctrl+1
- **THEN** 焦点切换到左侧面板（Sources）
