# citation-interaction Specification

## Purpose
TBD - created by archiving change update-citation-interaction. Update Purpose after archive.
## Requirements
### Requirement: Citation Hover Preview

系统必须（SHALL）在用户悬停引用标记时显示引用内容预览。

#### Scenario: 悬停显示引用片段

- **WHEN** 用户将鼠标悬停在引用标记上
- **THEN** 显示 Tooltip 预览
- **AND** Tooltip 包含引用片段文本
- **AND** Tooltip 显示来源名称

#### Scenario: 预览加载状态

- **WHEN** 引用内容需要从 API 获取
- **THEN** Tooltip 显示加载指示器
- **AND** 加载完成后显示内容

### Requirement: Citation Click Navigation

系统必须（SHALL）支持点击引用标记跳转到原文位置。

#### Scenario: 点击展开来源详情

- **WHEN** 用户点击引用标记
- **THEN** 打开对应来源的详情面板
- **AND** 滚动到引用所在位置（如支持位置信息）
- **AND** 高亮显示引用片段
