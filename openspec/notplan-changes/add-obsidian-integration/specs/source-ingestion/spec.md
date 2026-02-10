## ADDED Requirements

### Requirement: 文件夹批量导入
系统 MUST 支持从本地文件夹批量导入 Markdown 文件作为来源，包括 Obsidian vault 等知识库。

#### Scenario: 选择文件夹导入
- **WHEN** 用户在 Sources 面板点击"导入文件夹"
- **AND** 选择一个包含 Markdown 文件的本地文件夹
- **THEN** 系统显示待导入文件的预览列表
- **AND** 用户可取消选择特定文件
- **AND** 显示文件总数和总大小

#### Scenario: 执行批量导入
- **WHEN** 用户确认导入
- **THEN** 系统逐个处理选中的 Markdown 文件（预处理 → 分块 → 嵌入 → 存储）
- **AND** 显示实时进度（已处理/总数、成功/失败计数）
- **AND** 单个文件失败不影响其他文件的导入

#### Scenario: 过滤非内容目录
- **WHEN** 选择的文件夹包含 `.obsidian/`、`.git/`、`.trash/`、`node_modules/` 子目录
- **THEN** 系统自动排除这些目录中的文件
- **AND** 仅显示 `.md` 后缀的文件

### Requirement: Obsidian Wikilink 预处理
系统 MUST 在导入 Markdown 文件时将 Obsidian wikilink 语法转换为标准文本引用，保留语义信息。

#### Scenario: 转换 wikilink
- **WHEN** Markdown 文件包含 `[[page name]]` 语法
- **THEN** 系统将其转换为 `[page name](page name.md)` 格式
- **AND** 转换后的文本可被正常分块和检索

#### Scenario: 转换嵌入语法
- **WHEN** Markdown 文件包含 `![[file.png]]` 或 `![[note]]` 嵌入语法
- **THEN** 系统将其转换为文本引用 `[嵌入: file.png]` 或 `[嵌入: note]`
- **AND** 保留嵌入目标的名称作为上下文

### Requirement: Frontmatter 元数据提取
系统 MUST 在导入 Markdown 文件时提取 YAML frontmatter 中的元数据，用于来源标注。

#### Scenario: 提取 frontmatter tags
- **WHEN** Markdown 文件包含 `tags` 字段
- **THEN** 系统将 tags 提取并保存到 source 的 metadata 中

#### Scenario: 无 frontmatter 的文件
- **WHEN** Markdown 文件不包含 YAML frontmatter
- **THEN** 系统正常导入文件
- **AND** metadata 为空
