# content-conversion Specification

## Purpose
TBD - created by archiving change add-content-conversion-flow. Update Purpose after archive.
## Requirements
### Requirement: 对话转来源

系统 **MUST** 允许用户将对话内容转换为来源文档，使其可用于后续的 RAG 检索查询。

#### Scenario: 将整个会话转换为来源
- **WHEN** 用户选择将整个会话转换为来源
- **THEN** 系统提取会话中所有消息内容
- **AND** 创建新的来源文档，文件名包含会话信息
- **AND** 对内容进行分块和向量嵌入
- **AND** 来源状态变为 READY 后可用于 RAG 查询

#### Scenario: 将选定消息转换为来源
- **WHEN** 用户选择特定消息并请求转换为来源
- **THEN** 系统仅提取选定消息的内容
- **AND** 创建来源文档并进行处理
- **AND** 元数据记录转换来源的消息 ID

#### Scenario: 保留引用信息
- **WHEN** 对话中的消息包含引用标记
- **THEN** 转换后的来源内容保留引用标记文本
- **AND** 元数据中记录原始引用的 chunk_ids（如有）

### Requirement: 对话转 Studio 笔记

系统 **MUST** 允许用户将对话内容转换为 Studio 笔记，支持选择不同的输出类型进行结构化展示。

#### Scenario: 将消息转换为段落笔记
- **WHEN** 用户选择将消息转换为段落类型笔记
- **THEN** 系统创建 PARAGRAPH 类型的输出
- **AND** 内容保留原始对话文本
- **AND** 输出在 Studio 面板中显示

#### Scenario: 将消息转换为结构化笔记
- **WHEN** 用户选择将消息转换为要点或结构化类型笔记
- **THEN** 系统可选使用 AI 处理优化内容格式
- **AND** 创建对应类型的输出（BULLETS, STRUCTURED 等）

#### Scenario: 将会话转换为笔记
- **WHEN** 用户选择将整个会话转换为笔记
- **THEN** 系统合并所有消息内容
- **AND** 根据用户选择的输出类型创建笔记

### Requirement: 转换元数据追踪

系统 **MUST** 在转换生成的对象中记录转换来源信息，便于追溯和管理。

#### Scenario: 来源记录转换元数据
- **WHEN** 从对话转换创建来源
- **THEN** 来源的 metadata 字段包含 `converted_from_session` 和/或 `converted_from_messages`
- **AND** 记录 `conversion_timestamp`

#### Scenario: 笔记记录转换元数据
- **WHEN** 从对话转换创建笔记
- **THEN** 笔记的 content 字段包含 `_metadata` 对象
- **AND** 记录转换来源的会话和消息信息

### Requirement: 转换流程约束

系统 **MUST** 强制执行内容转换的单向流动规则。

#### Scenario: 来源不可转换
- **WHEN** 用户尝试将来源转换为其他类型
- **THEN** 系统不提供转换选项
- **AND** 来源被视为知识库的最终形态

#### Scenario: 允许的转换路径
- **GIVEN** 系统支持以下转换路径：
  - 对话 → Studio 笔记
  - 对话 → 来源
  - Studio 笔记 → 来源
- **WHEN** 用户执行任何转换操作
- **THEN** 操作必须符合上述允许的路径
