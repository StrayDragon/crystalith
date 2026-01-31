# studio-slides Specification

## Purpose
TBD - created by archiving change add-studio-ppt. Update Purpose after archive.
## Requirements
### Requirement: Studio 演示入口

系统 **MUST** 在 Studio 工具网格中提供 `SLIDES` 类型的“演示”入口，并绑定当前 notebook 上下文。

#### Scenario: 展示演示入口
- **WHEN** 工作区加载 Studio 面板
- **THEN** 工具网格中出现“演示”卡片
- **AND** 该卡片的 `output_type` 为 `SLIDES`

#### Scenario: 进入演示流程
- **WHEN** 用户点击“演示”工具
- **THEN** 系统为当前 notebook 打开或创建演示草稿
- **AND** 前端进入演示三阶段界面

### Requirement: 三阶段流程与状态持久化

系统 **MUST** 以“输入 → 大纲 → Markdown”的三阶段流程生成演示，并由后端持久化各阶段状态与内容。

#### Scenario: 选中来源的生成范围
- **WHEN** 用户在工作区已选择来源并触发演示生成
- **THEN** 后端仅使用选中来源作为生成上下文
- **AND** 未选择来源时拒绝生成并返回 400

#### Scenario: 状态恢复
- **WHEN** 用户重新进入演示流程
- **THEN** 系统加载已保存的大纲/Markdown
- **AND** 不自动重新生成除非用户显式触发

### Requirement: 生成进度与 SSE 事件流

系统 **MUST** 通过 SSE 输出大纲与 Markdown 生成进度，并提供可识别的错误与忙碌状态。

#### Scenario: 生成进度流
- **WHEN** 用户触发大纲或 Markdown 生成
- **THEN** SSE 持续推送 progress/toolcall/done 事件
- **AND** 前端以进度状态展示生成过程

#### Scenario: 忙碌与错误处理
- **WHEN** 同一演示正在生成且用户再次触发
- **THEN** SSE 返回 busy 事件并结束本次连接
- **AND** 失败时返回 error 事件并附带错误信息

### Requirement: 大纲与 Markdown 可编辑

系统 **MUST** 支持用户编辑并保存演示大纲与 Markdown，后端持久化修改并用于后续生成与预览。

#### Scenario: 保存大纲后生成 Markdown
- **WHEN** 用户编辑并保存大纲
- **THEN** 后端保存大纲内容
- **AND** 后续 Markdown 生成基于该大纲执行

#### Scenario: 保存 Markdown 后预览
- **WHEN** 用户编辑并保存 Markdown
- **THEN** 后端保存 Markdown 内容
- **AND** 预览使用最新保存版本

### Requirement: Slidev 预览能力

系统 **MUST** 提供演示预览接口，启动或复用 Slidev CLI 预览进程并返回可访问的预览 URL。

#### Scenario: 启动预览
- **WHEN** 用户点击“预览”
- **THEN** 后端启动或复用 Slidev 预览进程
- **AND** 返回预览 URL 供前端打开

#### Scenario: 预览不可用
- **WHEN** Slidev CLI 不可用或启动失败
- **THEN** 后端返回可识别错误
- **AND** 前端提示用户处理依赖或重试

### Requirement: 演示输出记录

系统 **MUST** 在 Markdown 阶段完成后生成 `SLIDES` 类型输出记录，并在 Studio 历史列表中展示。

#### Scenario: 输出记录创建
- **WHEN** Markdown 生成完成
- **THEN** 系统创建或更新 `SLIDES` 输出记录
- **AND** 输出记录包含最新更新时间与关联草稿信息

### Requirement: 演示一键生成入口

系统 **MUST** 在 Studio 工具网格的“演示”卡片提供一键生成能力，自动创建/更新演示草稿并串联大纲与 Markdown 生成。

#### Scenario: 一键生成演示

- **WHEN** 用户点击“演示”卡片
- **THEN** 系统为当前 notebook 创建或更新演示草稿并记录解析后的 source_ids
- **AND** 未选择来源时阻止生成并提示需要选择来源
- **AND** 自动依次触发大纲与 Markdown 生成的 SSE 流
- **AND** 前端展示生成进度并在完成后进入 Markdown 阶段

#### Scenario: 一键生成失败

- **WHEN** 任一生成阶段返回 error
- **THEN** 草稿状态标记为 error 并记录错误信息
- **AND** 前端提供重试入口

### Requirement: 演示生成参数

系统 **MUST** 提供演示生成参数，并将其持久化至草稿以驱动 LLM 生成与 frontmatter 生成。

#### Scenario: 设置参数并生成

- **WHEN** 用户设置幻灯片数量、受众层级、结构模板、语气风格、语言、排版密度、主题预设与 frontmatter 参数
- **THEN** 系统保存参数至演示草稿
- **AND** 大纲与 Markdown 生成提示词包含所选参数约束
- **AND** 生成的 Markdown 包含与参数一致的 frontmatter

#### Scenario: 参数回填

- **WHEN** 用户重新打开已有演示草稿
- **THEN** 系统回填该草稿保存的参数
- **AND** 未设置的参数使用默认值

#### Scenario: 选择主题预设

- **WHEN** 用户在演示配置中选择主题预设
- **THEN** 系统应用与该预设对应的 frontmatter 模板
- **AND** 用户仍可手动覆盖生成结果

#### Scenario: 手动覆盖 frontmatter

- **WHEN** 用户手动编辑 frontmatter 并保存 Markdown
- **THEN** 系统保留用户覆盖内容
- **AND** 后续预览使用手动覆盖版本

### Requirement: 演示配置单一来源
系统 **MUST** 提供由后端维护的演示生成配置集合（数量、受众、结构、语气、语言、密度、主题预设及默认值），并作为前端渲染与预览的唯一来源。

#### Scenario: 获取演示配置
- **WHEN** 前端进入演示配置界面
- **THEN** 系统从后端配置接口 `/v1/workspace/tools/slides/config` 读取演示配置集合
- **AND** 前端使用该集合渲染选项与默认值

#### Scenario: 主题预设一致性
- **WHEN** 用户选择主题预设且未提供 frontmatter 覆盖
- **THEN** 前端预览生成的 frontmatter 字段集合与后端生成一致
- **AND** 字段值与所选主题预设匹配

#### Scenario: 主题预设回退
- **WHEN** 提供未知的主题预设 ID
- **THEN** 系统回退到默认主题预设
- **AND** 生成结果与默认预设一致
