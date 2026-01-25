## ADDED Requirements

### Requirement: Source Correlation Detection

系统必须（SHALL）检测多个来源之间的关联关系。

#### Scenario: 检测来源关联

- **WHEN** 笔记本包含 2 个以上来源
- **AND** 用户触发分析
- **THEN** 系统检测来源之间的语义关联
- **AND** 显示关联强度评分
- **AND** 列出共享的主要概念

#### Scenario: 关联可视化

- **WHEN** 关联分析完成
- **THEN** 以网络图形式展示来源关系
- **AND** 节点大小反映来源重要性
- **AND** 边的粗细反映关联强度

### Requirement: Topic Clustering

系统必须（SHALL）对多来源内容进行主题聚类分析。

#### Scenario: 自动主题聚类

- **WHEN** 用户触发主题分析
- **THEN** 系统将内容聚类为多个主题
- **AND** 每个主题有自动生成的标签
- **AND** 显示每个主题包含的来源

#### Scenario: 主题分布可视化

- **WHEN** 主题聚类完成
- **THEN** 以饼图或柱状图展示主题分布
- **AND** 点击主题可查看相关内容

### Requirement: Contradiction Detection

系统必须（SHALL）检测不同来源之间的潜在矛盾。

#### Scenario: 检测语义矛盾

- **WHEN** 多个来源包含相关但可能矛盾的信息
- **THEN** 系统标记潜在矛盾点
- **AND** 显示矛盾的来源和具体内容
- **AND** 提供 AI 生成的矛盾分析

#### Scenario: 矛盾列表展示

- **WHEN** 检测到矛盾点
- **THEN** 以列表形式展示所有矛盾
- **AND** 每条矛盾可展开查看详情
- **AND** 支持用户标记为"已解决"
