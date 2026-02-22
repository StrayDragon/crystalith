# content-conversion Specification

## Purpose

定义“内容转换”能力：在对话（Session/Message）、Studio 笔记（Output）与来源（Source）之间提供受控的转换路径，并记录可追溯的转换元数据，确保转换后的内容可被后续检索与生成流程复用。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`
- `workspace-chat-ui/spec.md`
- `workspace-studio-ui/spec.md`
- `source-ingestion/spec.md`

## Requirements
### Requirement: 对话转来源

系统 **MUST** 允许用户将对话内容转换为来源文档，使其可用于后续的 RAG 检索查询。

最小行为：
- 支持将整个会话或选定消息集合转换为 Source（文件名包含会话信息）
- 转换后 MUST 进行分块与向量嵌入；Source 状态为 `ready` 后可用于 RAG 查询
- 若对话包含引用标记，转换后的内容 MUST 保留引用标记文本；当前实现不保留结构化 citations（不会把 chunk_ids/citations 写入 Source.metadata）

### Requirement: 对话转 Studio 笔记

系统 **MUST** 允许用户将对话内容转换为 Studio 笔记，支持选择不同的输出类型进行结构化展示。

最小行为：
- 支持从消息集合或整个会话创建 Studio 输出
- `PARAGRAPH` 输出 MUST 保留原始对话文本
- `BULLETS/STRUCTURED` 等结构化输出 MAY 使用 AI 处理优化格式

### Requirement: 转换元数据追踪

系统 **MUST** 在转换生成的对象中记录转换来源信息，便于追溯和管理。

最小字段约束：
- 对话→来源：Source.metadata MUST 包含 `converted_from_session` 和/或 `converted_from_messages`，并记录 `conversion_timestamp`
- 对话→笔记：Output.content MUST 包含 `_metadata`，记录转换来源的会话/消息信息

### Requirement: 转换流程约束

系统 MUST 只提供以下允许的转换路径：

- 对话 → Studio 笔记
- 对话 → 来源
- Studio 笔记 → 来源
- 来源问答（source-scoped QA 记录）→ 来源

Source 本体 MUST NOT 提供转换为其他实体类型（如 Output/Session）的入口；Source 被视为知识库的最终形态（可被检索/生成复用）。
