## ADDED Requirements
### Requirement: 来源选择作为最小范围
系统 MUST 以“来源”为最小选择单元限定对话与 Studio 输出范围，不展示引用（chunk）级的选择控件。

#### Scenario: 来源范围选择
- **WHEN** 用户在 Sources 面板进行范围选择
- **THEN** 仅显示来源级复选框
- **AND** 不出现引用列表或引用多选控件

### Requirement: Studio 输出需至少选择来源
系统 MUST 在用户未选择任何来源时禁用 Studio 输出触发，并提示需要先选择来源。

#### Scenario: 禁用空来源输出
- **WHEN** 用户未选中任何来源
- **THEN** Studio 输出入口为不可用状态
- **AND** 提示用户需先选择来源

### Requirement: 来源索引状态可见
系统 MUST 在来源列表中明确展示每个来源的 embedding/索引状态。

#### Scenario: 展示索引状态
- **WHEN** 来源列表渲染
- **THEN** 每个来源项显示“已索引 / 处理中 / 失败”等状态标识
- **AND** 非已索引状态可附带提示说明

### Requirement: 非就绪来源不可选
系统 MUST 禁用“处理中/失败”的来源选择，并提供明确的不可用提示。

#### Scenario: 禁用未完成来源
- **WHEN** 来源状态为处理中或失败
- **THEN** 该来源复选框为不可用状态
- **AND** 悬停显示“未完成索引，暂不可用”的提示

### Requirement: 失败来源可重嵌入
系统 MUST 在来源状态为失败时提供重嵌入入口，允许用户触发重新索引。

#### Scenario: 触发重嵌入
- **WHEN** 用户点击失败来源的“重新嵌入”入口
- **THEN** 系统向后端发起重试索引请求
- **AND** 来源状态切换为处理中
