## ADDED Requirements

### Requirement: 演示一键生成入口

系统 **MUST** 在 Studio 工具网格的“演示”卡片提供一键生成能力，自动创建/更新演示草稿并串联大纲与 Markdown 生成。

#### Scenario: 一键生成演示

- **WHEN** 用户点击“演示”卡片
- **THEN** 系统为当前 notebook 创建或更新演示草稿并记录选中的引用
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
