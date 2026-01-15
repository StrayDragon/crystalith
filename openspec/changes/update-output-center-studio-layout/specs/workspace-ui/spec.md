## ADDED Requirements
### Requirement: 输出中心 Studio 工具区
系统 SHALL 在输出中心顶部展示 Studio 工具区，以网格展示结构化输出工具卡片。

#### Scenario: 生成结构化输出
- **WHEN** 用户点击某个工具卡片
- **THEN** 系统设置对应输出类型并立即加入队列
- **THEN** 输出中心展示队列进度更新

#### Scenario: 工具禁用
- **WHEN** 输出中心处于不可用状态（如未创建笔记本）
- **THEN** Studio 工具区的操作项显示禁用状态且不可触发

### Requirement: 输出中心统一列表
系统 SHALL 使用扁平列表呈现输出历史，并将提炼输出与结构化输出统一为同构行式卡片。

#### Scenario: 列表行式结构
- **WHEN** 输出历史存在
- **THEN** 列表行包含图标、标题、元信息与右侧更多菜单
- **THEN** 点击行头部会复用该输出并加入队列

#### Scenario: 空状态
- **WHEN** 输出历史为空
- **THEN** 输出中心显示统一的空状态提示
