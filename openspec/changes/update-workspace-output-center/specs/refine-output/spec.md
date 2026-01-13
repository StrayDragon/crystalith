## MODIFIED Requirements
### Requirement: 提炼生成队列
系统 SHALL 支持提炼生成任务队列，并在前端以占位卡片跟踪任务状态。

#### Scenario: 任务排队
- **WHEN** 用户连续触发多次提炼
- **THEN** 新任务进入队列并生成占位卡片

#### Scenario: 任务完成
- **WHEN** 任务生成完成
- **THEN** 占位卡片更新为真实内容并提示完成状态

## ADDED Requirements
### Requirement: 提炼结果卡片操作
系统 SHALL 支持对提炼结果卡片进行复制、固定与删除操作。

#### Scenario: 复制内容
- **WHEN** 用户点击“复制”
- **THEN** 系统将该卡片内容复制到剪贴板

#### Scenario: 固定结果
- **WHEN** 用户点击“固定”
- **THEN** 该卡片置顶显示并标记为固定状态

#### Scenario: 删除结果
- **WHEN** 用户点击“删除”
- **THEN** 该卡片从列表中移除
