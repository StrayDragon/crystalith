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
- **THEN** 中间对话区展示响应，右侧输出区保留可触发的提炼入口

### Requirement: 右侧提炼卡片与队列
系统 SHALL 在右侧提供提炼卡片与生成队列，用户手动触发生成并选择队列条目查看输出。

#### Scenario: 点击提炼生成
- **WHEN** 用户在提炼卡片点击生成
- **THEN** 生成任务进入队列并显示生成状态

#### Scenario: 选择队列任务
- **WHEN** 用户点击队列中的某条任务
- **THEN** 右侧输出区展示对应任务结果

### Requirement: 中文界面
系统 SHALL 仅提供中文界面文案，并不实现国际化。

#### Scenario: 显示中文文案
- **WHEN** 用户使用 UI
- **THEN** 看到的界面文案为中文

### Requirement: 空状态引导与快捷创建
系统 SHALL 在无可用 Notebook 时提供创建引导，并支持快捷提交。

#### Scenario: 无 Notebook 的空状态
- **WHEN** 用户首次进入且列表为空
- **THEN** 显示创建笔记本卡片与引导提示，并禁用上传/对话输入

#### Scenario: 快捷创建
- **WHEN** 用户在创建输入框中按下 Enter
- **THEN** 触发创建 Notebook 的请求并在完成后切换为可用状态
