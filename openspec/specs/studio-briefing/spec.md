# studio-briefing Specification

## Purpose
TBD - created by archiving change enhance-studio-briefing. Update Purpose after archive.
## Requirements
### Requirement: 章节目录

系统 **MUST** 基于报告分节标题生成可导航目录。

#### Scenario: 渲染目录

- **WHEN** 报告包含多个分节
- **THEN** 显示目录列表
- **AND** 目录项显示分节标题

#### Scenario: 目录跳转

- **WHEN** 用户点击目录项
- **THEN** 页面滚动到对应分节

### Requirement: 章节折叠

系统 **MUST** 支持分节内容折叠与展开。

#### Scenario: 折叠分节

- **WHEN** 用户点击分节标题或折叠按钮
- **THEN** 分节内容收起

#### Scenario: 展开分节

- **WHEN** 用户再次点击
- **THEN** 分节内容展开
