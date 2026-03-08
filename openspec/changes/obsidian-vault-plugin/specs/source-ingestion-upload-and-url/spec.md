# source-ingestion-upload-and-url 规范增量

## MODIFIED Requirements

### Requirement: 上传端点必须保留受支持写作工具的 Markdown 语义
对于标准 Markdown 上传，系统 MUST 在进入 `chunk / embed / store` 之前执行语义预处理，以兼容常见写作工具的 Markdown 扩展语法，并将可提取的文档元数据写入 source metadata。

#### Scenario: 上传 Obsidian 风格 wikilink 时进行标准化
- **WHEN** 用户上传一个 `.md` / `text/markdown` 文件，内容包含 `[[page]]` 或 `[[page|alias]]`
- **THEN** 系统 SHALL 将其转换为标准 Markdown 链接文本后再进行 chunking
- **AND** 上传后的来源内容 SHALL 保留可检索的链接语义

#### Scenario: 上传 Obsidian 风格嵌入时转为文本引用
- **WHEN** 上传的 Markdown 文件包含 `![[file]]` 或 `![[file|alias]]`
- **THEN** 系统 SHALL 将其转换为可检索的文本引用
- **AND** v1 SHALL NOT 要求展开嵌入内容本体

#### Scenario: 上传 Markdown 时提取 frontmatter 到来源元数据
- **WHEN** 上传的 Markdown 文件包含可解析的 YAML frontmatter
- **THEN** 系统 SHALL 将支持字段（`title`、`tags`、`aliases`、`date`）写入 `source.metadata.frontmatter`
- **AND** SHALL 不影响正常的 `source ready` 语义
