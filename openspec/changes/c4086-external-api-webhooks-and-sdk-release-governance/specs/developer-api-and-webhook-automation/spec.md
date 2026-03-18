# developer-api-and-webhook-automation 规范增量

## ADDED Requirements

### Requirement: External Automation MUST Use a Stable Developer API Boundary
系统 MUST 为外部系统提供稳定的 developer API boundary，而不是鼓励私有脚本直接绕接内部实现。

#### Scenario: 外部系统触发或读取 Crystalith 工作流
- **WHEN** 第三方系统调用 notebooks、sources、runs、knowledge packs 或等价对象
- **THEN** 系统 SHALL 通过受控 developer API 暴露这些能力
- **AND** SHALL 使用明确 token scope 与版本边界

### Requirement: Webhooks MUST Be Versioned, Signed, and Retryable
系统 MUST 将 webhooks 视为正式契约，而不是最佳努力通知。

#### Scenario: 外部系统订阅研究完成或发布完成事件
- **WHEN** 系统向外部 endpoint 投递 webhook
- **THEN** 事件 SHALL 带有稳定版本语义与签名
- **AND** SHALL 定义明确的重试与失败处理策略
