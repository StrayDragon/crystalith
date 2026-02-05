## ADDED Requirements

### Requirement: Error Boundary Protection
前端 SHALL 在全局和各领域面板级别设置 ErrorBoundary。当子组件发生未捕获异常时，ErrorBoundary MUST 显示友好的错误提示并提供"重试"操作。

#### Scenario: 面板组件崩溃恢复
- **WHEN** ChatPanel 内部发生 JavaScript 异常
- **THEN** 仅 ChatPanel 区域显示错误提示和重试按钮，其他面板不受影响

### Requirement: Operation Retry UI
前端 SHALL 对关键操作（消息发送、输出生成、source 上传）在失败时提供 retry 按钮。

#### Scenario: 消息发送失败重试
- **WHEN** 消息发送因网络错误失败
- **THEN** 消息气泡显示发送失败状态和"重新发送"按钮，点击后重新发送
