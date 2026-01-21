## ADDED Requirements
### Requirement: 文档上传与状态跟踪
系统 SHALL 允许用户将 txt/markdown 文档上传到 Notebook 并跟踪处理状态。

#### Scenario: 上传文档
- **WHEN** 用户向 Notebook 上传 txt/markdown 文件
- **THEN** 来源显示为“处理中”，成功后变为“已就绪”

### Requirement: 文档索引
系统 SHALL 对文档进行分块与向量化，并建立可检索索引。

#### Scenario: 文档完成索引
- **WHEN** 文档处理成功
- **THEN** 其分块可被问答检索到

### Requirement: 文档移除
系统 SHALL 允许用户删除文档并移除其索引分块。

#### Scenario: 删除文档
- **WHEN** 用户从 Notebook 删除文档
- **THEN** 该文档的分块不再出现在检索结果中
