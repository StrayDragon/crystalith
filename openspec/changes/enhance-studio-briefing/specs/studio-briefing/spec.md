## ADDED Requirements

### Requirement: 报告模板系统

系统 **MUST** 提供多种专业报告模板。

#### Scenario: 选择报告模板

- **WHEN** 用户生成报告
- **THEN** 可选择模板类型（研究报告/商业计划/技术文档）
- **AND** 报告按模板结构生成

#### Scenario: 模板结构

- **WHEN** 使用研究报告模板
- **THEN** 包含摘要、引言、方法、结果、讨论、结论等章节

### Requirement: 自动目录生成

系统 **MUST** 基于标题层级自动生成可导航目录。

#### Scenario: 渲染目录

- **WHEN** 报告包含多级标题
- **THEN** 侧边栏显示可点击的目录树

#### Scenario: 目录导航

- **WHEN** 用户点击目录项
- **THEN** 页面平滑滚动到对应章节
- **AND** 当前章节在目录中高亮

### Requirement: 图表支持

系统 **MUST** 支持在报告中插入数据图表。

#### Scenario: 插入图表

- **WHEN** 报告数据适合可视化
- **THEN** 自动生成相应图表（柱状图/饼图/折线图）

#### Scenario: 图表交互

- **WHEN** 用户悬停在图表数据点上
- **THEN** 显示具体数值

### Requirement: 引用管理

系统 **MUST** 自动生成参考文献列表。

#### Scenario: 生成参考文献

- **WHEN** 报告包含引用
- **THEN** 在报告末尾生成参考文献列表

#### Scenario: 引用格式切换

- **WHEN** 用户选择引用格式（APA/MLA/Chicago）
- **THEN** 参考文献按所选格式重新格式化

### Requirement: 协作批注

系统 **MUST** 支持在报告中添加批注。

#### Scenario: 添加批注

- **WHEN** 用户选中文本并点击批注
- **THEN** 显示批注输入框
- **AND** 批注显示在侧边栏

#### Scenario: 查看批注

- **WHEN** 用户点击批注标记
- **THEN** 高亮对应文本
- **AND** 显示批注内容

### Requirement: 报告导出

系统 **MUST** 支持将报告导出为多种格式。

#### Scenario: 导出为 PDF

- **WHEN** 用户选择导出为 PDF
- **THEN** 生成带目录和页码的 PDF 文件

#### Scenario: 导出为 Word

- **WHEN** 用户选择导出为 Word
- **THEN** 生成保留格式的 .docx 文件
