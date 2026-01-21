# refine-output Specification

## Purpose
TBD - created by archiving change add-research-workspace. Update Purpose after archive.
## Requirements
### Requirement: 提炼输出
系统 SHALL 提供“提炼”输出能力。

#### Scenario: 生成提炼
- **WHEN** 用户在提炼卡片点击生成
- **THEN** 系统返回提炼内容并在右侧输出区展示

### Requirement: 批量提炼输出
系统 SHALL 支持在一次请求中生成多个提炼格式的输出。

#### Scenario: 一次生成多格式
- **WHEN** 客户端请求多个提炼格式
- **THEN** 系统返回每个格式的提炼结果以便即时切换展示

### Requirement: 自定义提炼提示词
系统 SHALL 允许用户自定义提炼提示词以控制输出关注点。

#### Scenario: 自定义提炼内容
- **WHEN** 用户编辑提炼卡片中的提示词
- **THEN** 系统使用该提示词生成提炼结果

### Requirement: 提炼生成队列
系统 SHALL 支持提炼生成任务队列。

#### Scenario: 任务排队
- **WHEN** 用户连续触发多次提炼
- **THEN** 系统将请求加入队列并依序生成

### Requirement: 提炼格式选项
系统 SHALL 支持段落式、要点式、结构化三种提炼格式。

#### Scenario: 段落式提炼
- **WHEN** 用户选择段落式格式
- **THEN** 系统返回连续段落的提炼内容

#### Scenario: 要点式提炼
- **WHEN** 用户选择要点式格式
- **THEN** 系统返回项目符号的提炼内容

#### Scenario: 结构化提炼
- **WHEN** 用户选择结构化格式
- **THEN** 系统返回包含字段的提炼内容（标题/要点/关键术语/引用）

### Requirement: 提炼格式可扩展
系统 SHALL 允许通过配置扩展提炼格式列表。

#### Scenario: 增加新的提炼格式
- **WHEN** 配置中新增提炼格式定义
- **THEN** UI 输出区出现新的提炼选项

