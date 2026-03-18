# notebook-outline-backlinks-and-structural-navigation 规范增量

## ADDED Requirements

### Requirement: Notebook Structure MUST Expose a Stable Navigable Outline
系统 MUST 为 notebook 提供稳定的结构导航树，而不是让长文档只能靠滚动查找。

#### Scenario: 用户在长 notebook 中定位内容
- **WHEN** 用户需要跳转到某个标题、输出块或关键引用点
- **THEN** 系统 SHALL 提供稳定 outline 与结构级定位入口
- **AND** 导航目标 SHALL 落到同一套 notebook 结构节点上

### Requirement: Structural Nodes MUST Support Backlinks and Return Paths
系统 MUST 让结构节点支持 backlinks、focus 和 return-point，而不是只支持单向跳转。

#### Scenario: 用户从引用跳回原位置
- **WHEN** 用户从某个引用或关联节点跳转到结构目标
- **THEN** 系统 SHALL 能提供回链或 return path
- **AND** SHALL 支持在结构层进行聚焦、折叠或恢复上次位置
