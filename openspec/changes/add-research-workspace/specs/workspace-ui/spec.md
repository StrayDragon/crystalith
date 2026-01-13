## ADDED Requirements
### Requirement: 三栏工作区布局
系统 SHALL 提供三栏布局：左侧来源/引用区，中间对话区，右侧输出区。

#### Scenario: 打开 Notebook
- **WHEN** 用户打开一个 Notebook
- **THEN** 左侧展示来源列表与引用，中间展示聊天，右侧展示输出面板

### Requirement: 输入-对话-输出主流程
系统 SHALL 在 UI 中体现“输入 -> 对话 -> 输出”的工作流程。

#### Scenario: 触发对话与输出
- **WHEN** 用户提交问题或指令
- **THEN** 中间对话区展示响应，右侧输出区展示对应结果

### Requirement: 中文界面
系统 SHALL 仅提供中文界面文案，并不实现国际化。

#### Scenario: 显示中文文案
- **WHEN** 用户使用 UI
- **THEN** 看到的界面文案为中文
