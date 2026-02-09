## Context

Obsidian vault 本质是一个包含 `.md` 文件的本地文件夹，带有特殊语法（wikilinks、嵌入、frontmatter）和目录结构。Crystalith 需要能够读取这些文件并智能地转换为 source 进行分析。

## Goals / Non-Goals

- Goals:
  - 支持从本地文件夹（含 Obsidian vault）批量导入 Markdown 文件
  - 正确处理 Obsidian 特有语法（wikilinks → 标准链接引用）
  - 提取 frontmatter 元数据用于 source 标注
  - 提供清晰的导入进度和错误反馈
  - 支持选择性导入（排除特定文件夹如 `.obsidian/`、`templates/`）
- Non-Goals:
  - 不实现双向同步（Obsidian ↔ Crystalith）
  - 不实现 Obsidian 插件
  - 不处理 Obsidian Canvas（.canvas 文件）
  - 不支持实时文件夹监听（仅一次性导入）

## Decisions

### D1: 导入方式 — 文件上传（非服务器端路径）

- **Decision**: 前端使用 HTML5 Directory API (`webkitdirectory`) 让用户选择文件夹，将文件通过 multipart/form-data 批量上传。
- **Alternatives considered**:
  - 服务器端路径读取：安全风险，需要服务器文件系统访问
  - 压缩包上传：用户体验差，需要额外步骤
- **Rationale**: Directory API 已被主流浏览器支持，用户体验自然，且不需要服务器文件系统权限。

### D2: Wikilink 处理策略

- **Decision**: 在解析阶段将 `[[page]]` 转换为 `[page](page.md)`，`![[image.png]]` 转换为文本引用 `[嵌入: image.png]`。保留原始链接文本作为上下文信息。
- **Rationale**: Crystalith 分析的是文本语义，wikilink 的链接关系可通过文本引用保留语义，无需实际解析链接目标。

### D3: Frontmatter 处理

- **Decision**: 提取 YAML frontmatter 中的 `tags`、`aliases`、`title`、`date` 字段，映射到 source 的 metadata。未来 source 标签系统上线后可直接使用。
- **Rationale**: Frontmatter 包含有价值的分类信息，丢弃可惜。

### D4: 文件过滤策略

- **Decision**: 默认排除 `.obsidian/`、`node_modules/`、`.git/`、`.trash/` 目录。支持用户在前端预览时手动取消选择特定文件。
- **Rationale**: 这些目录包含配置/缓存文件，不是知识内容。

## Risks / Trade-offs

- Directory API 在 Firefox 上支持有限（可降级为多文件选择）
- 大 vault（>1000 文件）的上传可能较慢，需要分批处理
- Wikilink 转换可能丢失部分语义（如嵌入内容无法展开）

## Open Questions

- 是否需要支持 Obsidian 的 Dataview 查询语法？（建议暂不支持）
- 导入后是否保留原始目录结构信息？（建议作为 metadata 保留）
