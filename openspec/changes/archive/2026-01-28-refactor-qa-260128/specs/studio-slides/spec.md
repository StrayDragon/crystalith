## ADDED Requirements
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
