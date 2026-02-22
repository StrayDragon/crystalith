# studio-briefing Specification

## Purpose

定义 Studio 中 BRIEFING 类型输出的展示与交互：以可导航目录组织分节内容，并支持章节折叠/展开，便于快速浏览与定位关键信息。

## Related specs

- `GLOSSARY.md`
- `workspace-studio-ui/spec.md`
- `output-rendering/spec.md`
- `output-graph/spec.md`

## Requirements
### Requirement: 章节目录

系统 **MUST** 基于报告分节标题生成可导航目录。
报告包含多个分节时 MUST 显示目录列表（目录项为分节标题）；用户点击目录项时 MUST 滚动到对应分节。

### Requirement: 章节折叠

系统 **MUST** 支持分节内容折叠与展开。
用户点击分节标题或折叠按钮时 MUST 收起分节内容；再次点击 MUST 展开分节内容。
