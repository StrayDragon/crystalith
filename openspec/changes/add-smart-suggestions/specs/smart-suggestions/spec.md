## ADDED Requirements

### Requirement: Smart Question Suggestions

系统必须（SHALL）根据来源内容自动生成智能问题建议，帮助用户探索材料。

#### Scenario: 来源上传后生成建议

- **WHEN** 用户上传来源完成
- **THEN** 系统自动生成 3-5 个建议问题
- **AND** 建议问题与来源内容相关
- **AND** 建议显示在 Chat 面板

#### Scenario: 点击建议填入输入框

- **WHEN** 用户点击建议问题卡片
- **THEN** 问题文本自动填入聊天输入框
- **AND** 输入框获得焦点

#### Scenario: 刷新建议

- **WHEN** 用户点击刷新建议按钮
- **THEN** 系统生成新的建议问题
- **AND** 新建议与之前不重复（尽可能）

### Requirement: Suggestion Context Awareness

系统必须（SHALL）根据上下文变化动态更新建议。

#### Scenario: 来源变化更新建议

- **WHEN** 用户添加或删除来源
- **THEN** 建议问题基于新的来源组合重新生成

#### Scenario: 对话上下文感知

- **WHEN** 用户已进行多轮对话
- **THEN** 后续建议考虑对话历史
- **AND** 建议更深入或相关的问题
