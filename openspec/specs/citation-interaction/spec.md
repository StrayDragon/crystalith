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

### Requirement: Multi-Citation Comparison

系统必须（SHALL）支持多个引用的选择和对比分析。

#### Scenario: 多选引用

- **WHEN** 用户 Shift+点击多个引用标记
- **THEN** 选中的引用显示高亮状态
- **AND** 显示对比分析触发按钮

#### Scenario: 触发对比分析

- **WHEN** 用户选中多个引用
- **AND** 点击对比分析按钮
- **THEN** 展示多引用对比视图
- **AND** 显示相似点和差异点分析

### Requirement: 引用选择驱动后续交互
系统 MUST 允许用户选中多个引用，并将该选择应用于对话与 Studio 输出的上下文范围。

#### Scenario: 选中引用后对话使用
- **WHEN** 用户选中引用后发起对话提问
- **THEN** 系统仅使用选中引用作为上下文生成回答
- **AND** 返回的引用仅来自选中范围

#### Scenario: 对话引用范围快照提示
- **WHEN** 系统返回基于选中引用的对话回答
- **THEN** 聊天消息展示引用范围指示器（来源名/数量）
- **AND** 指示器反映发送当时的引用快照，而非当前实时选择

#### Scenario: 选中引用后生成 Studio 输出
- **WHEN** 用户在选中引用状态下触发 Studio 输出
- **THEN** 系统仅使用选中引用作为输出上下文
- **AND** 未选中引用时回退到默认检索
