## ADDED Requirements

### Requirement: 拖拽上传文件
Sources 面板 MUST 支持拖拽文件上传，提供视觉反馈。

#### Scenario: 拖拽文件到 Sources 面板
- **WHEN** 用户将文件拖拽到 Sources 面板区域
- **THEN** 面板显示高亮边框和"拖放文件到此处"提示
- **AND** 用户释放文件后触发上传流程

#### Scenario: 拖拽非支持格式文件
- **WHEN** 用户拖拽不支持的文件格式
- **THEN** 面板显示提示说明支持的格式
- **AND** 不触发上传

### Requirement: AI 操作取消
系统 MUST 支持取消进行中的 AI 生成操作（QA 流式回答、Studio 输出生成）。

#### Scenario: 取消流式 QA
- **WHEN** AI 正在生成流式回答
- **AND** 用户点击"停止生成"按钮
- **THEN** 系统中断 LLM 生成流
- **AND** 已接收的部分内容正常显示
- **AND** 输入框恢复可用状态

#### Scenario: 取消 Studio 输出生成
- **WHEN** Studio 输出正在生成队列中处理
- **AND** 用户点击取消按钮
- **THEN** 任务状态变为"已取消"
- **AND** 不在输出列表中添加不完整的结果

### Requirement: Modal 焦点陷阱
系统 MUST 在所有 Modal 对话框中实现焦点陷阱，Tab 键循环在 Modal 内部元素之间。

#### Scenario: Tab 键焦点循环
- **WHEN** Modal 对话框打开
- **AND** 用户按 Tab 键
- **THEN** 焦点在 Modal 内的可交互元素之间循环
- **AND** 焦点不逃逸到 Modal 外的背景内容

#### Scenario: ESC 关闭 Modal
- **WHEN** Modal 对话框打开
- **AND** 用户按 ESC 键
- **THEN** Modal 关闭
- **AND** 焦点返回到触发 Modal 的元素

### Requirement: 空状态操作引导
系统 MUST 在内容为空时提供清晰的操作引导，帮助新用户理解使用流程。

#### Scenario: 无来源时引导
- **WHEN** notebook 无来源
- **THEN** Sources 面板显示引导卡片提示添加文档

#### Scenario: 有来源但无会话时引导
- **WHEN** notebook 有来源但无会话消息
- **THEN** Chat 面板显示提示选择来源后提问

#### Scenario: Studio 无输出时引导
- **WHEN** notebook 无 Studio 输出
- **THEN** Studio 面板显示引导流程：选择来源 → 点击工具卡片

### Requirement: 统一 Toast 通知样式
系统 MUST 统一所有操作反馈的 Toast 样式、颜色和显示时长。

#### Scenario: 操作成功 Toast
- **WHEN** 用户操作成功
- **THEN** 显示绿色 Toast 通知
- **AND** 3 秒后自动关闭

#### Scenario: 操作失败 Toast
- **WHEN** 用户操作失败
- **THEN** 显示红色 Toast 通知
- **AND** 5 秒后自动关闭
- **AND** 用户可手动关闭
