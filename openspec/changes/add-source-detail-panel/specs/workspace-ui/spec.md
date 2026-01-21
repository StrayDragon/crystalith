## MODIFIED Requirements

### Requirement: Source Detail Dialog

系统必须（SHALL）提供来源详情对话框，展示来源的完整信息并支持交互操作。

#### Scenario: 显示来源摘要

- **WHEN** 用户打开来源详情对话框
- **THEN** 系统调用 `/sources/{id}/summary` API
- **AND** 展示来源摘要内容
- **AND** 摘要加载时显示加载状态

#### Scenario: 显示关键词标签

- **WHEN** 来源详情加载完成
- **THEN** 显示来源关键词作为可点击标签
- **AND** 点击标签可触发相关搜索

#### Scenario: 显示统计信息

- **WHEN** 来源详情加载完成
- **THEN** 显示字数统计
- **AND** 显示页数（如适用）
- **AND** 显示上传时间

#### Scenario: 在来源内提问

- **WHEN** 用户在来源详情中输入问题
- **AND** 点击发送
- **THEN** 系统仅使用当前来源作为上下文进行问答
- **AND** 答案展示在详情面板内
