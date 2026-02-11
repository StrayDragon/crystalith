# studio-collapsible-tools Specification

## Purpose

定义 Studio 模块内工具区的可收纳（折叠/展开）交互规范，使用户可以隐藏不常用的工具区以释放空间给输出和笔记列表。

## Requirements

### Requirement: Studio 工具区可收纳
Studio 模块 MUST 支持工具区（ExtractTo）的折叠/展开切换。折叠时工具网格隐藏，空间释放给输出/笔记列表；展开时工具网格正常显示。

#### Scenario: 双击折叠工具区
- **WHEN** 用户双击工具区标题栏
- **THEN** 工具网格 MUST 以 200ms ease 动画隐藏
- **AND** 输出/笔记列表 MUST 扩展占据释放的空间

#### Scenario: 双击展开工具区
- **WHEN** 用户双击已折叠的工具区标题栏
- **THEN** 工具网格 MUST 以 200ms ease 动画重新显示
- **AND** 输出/笔记列表 MUST 调整回共享空间

#### Scenario: 单击不触发折叠
- **WHEN** 用户单击工具区标题栏
- **THEN** 系统 MUST NOT 触发折叠/展开操作

#### Scenario: 折叠状态持久化
- **WHEN** 用户折叠或展开工具区
- **THEN** 系统 MUST 将当前折叠状态保存到 localStorage
- **AND** 下次打开页面时 MUST 恢复上次的折叠状态

#### Scenario: 折叠状态视觉提示
- **WHEN** 工具区处于折叠状态
- **THEN** MUST 有明显的视觉提示表明工具区已折叠且可双击展开
