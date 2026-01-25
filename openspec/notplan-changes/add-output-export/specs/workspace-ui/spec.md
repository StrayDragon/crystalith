## ADDED Requirements

### Requirement: Output Copy to Clipboard

系统必须（SHALL）支持将生成的输出内容复制到剪贴板。

#### Scenario: 复制输出内容

- **WHEN** 用户点击输出卡片的复制按钮
- **THEN** 输出内容被复制到剪贴板
- **AND** 显示复制成功的反馈提示

#### Scenario: 复制格式化内容

- **WHEN** 复制思维导图或时间线输出
- **THEN** 内容以 Markdown 格式复制
- **AND** 保留结构化格式

### Requirement: Output Export to File

系统必须（SHALL）支持将生成的输出导出为文件。

#### Scenario: 导出为 Markdown 文件

- **WHEN** 用户点击导出按钮
- **AND** 选择 Markdown 格式
- **THEN** 浏览器下载 .md 文件
- **AND** 文件名包含输出类型和生成日期

#### Scenario: 导出包含元数据

- **WHEN** 导出输出文件
- **THEN** 文件头部包含来源信息
- **AND** 包含生成时间戳
- **AND** 包含笔记本名称
