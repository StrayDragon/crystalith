## ADDED Requirements

### Requirement: Source Multi-select UI
SourcesPanel SHALL 支持多选操作。用户 MUST 能通过 Ctrl+Click 选择单个、Shift+Click 范围选择、全选/取消全选。选中状态下 SHALL 显示批量操作栏。

#### Scenario: Ctrl+Click 多选
- **WHEN** 用户按住 Ctrl 点击多个 source
- **THEN** 被点击的 source 切换选中状态，显示已选数量和批量操作按钮

#### Scenario: 批量操作栏
- **WHEN** 有 source 被选中
- **THEN** 面板顶部显示批量操作栏（删除、标签、re-embed），显示已选数量

### Requirement: Source List Sorting
Source 列表 SHALL 支持多维度排序（名称、创建日期、大小、类型）。

#### Scenario: 按日期排序
- **WHEN** 用户选择 "按日期排序"
- **THEN** source 列表按创建日期降序排列
