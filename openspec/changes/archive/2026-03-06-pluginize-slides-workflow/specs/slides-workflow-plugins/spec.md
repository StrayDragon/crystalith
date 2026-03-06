# slides-workflow-plugins Specification (Delta)

## ADDED Requirements

### Requirement: Slides workflow plugin is a first-class contract
宿主 MUST 支持 `SlidesWorkflowPlugin`（或等价接口）作为一类独立插件契约；该契约 MUST 至少能声明以下能力：

- 稳定的 plugin id 与 engine id
- default prompt
- rich `config_schema` 与 defaults
- outline / markdown 两阶段生成入口
- 可选的 `frontend_bundle` 与 preview/renderer descriptor

#### Scenario: Host loads a slides workflow plugin
- **WHEN** 系统启动并发现一个实现 `SlidesWorkflowPlugin` 的插件
- **THEN** 宿主 SHALL 校验其兼容性并将其注册为 slides workflow 候选
- **AND** SHALL 能从该插件读取默认配置、生成入口与前端声明

### Requirement: Slides workflow activation is single-active and deterministic
在当前版本中，宿主 MUST 只允许一个 active slides workflow plugin 支撑 `SLIDES` tool；选择规则 MUST 确定且可诊断。

选择规则至少包括：

- 配置了 `slides.default_plugin` 时，优先选择该 plugin id
- 未配置时，若仅发现一个兼容插件，则自动选中
- 未配置且发现多个兼容插件时，宿主 MUST 拒绝隐式选择并输出冲突诊断

#### Scenario: Multiple slides plugins require explicit selection
- **WHEN** 系统同时发现多个兼容的 slides workflow plugin，且未配置默认插件
- **THEN** 宿主 SHALL 不暴露 `SLIDES` tool 为可用能力
- **AND** SHALL 提供结构化诊断提示用户安装/启用/选择正确插件

### Requirement: Repository provides an official reference slides plugin
仓库 MUST 提供至少一个官方 slides workflow plugin 作为参考实现，用于展示“复杂插件”应如何组织共享 schema、生成逻辑、前端 bundle 与 README/安装说明。

该参考插件 MUST 覆盖：

- 多阶段生成（outline / markdown）
- 丰富配置项（quantity / audience / structure / tone / language / density / theme / frontmatter）
- 预览契约与前端 bundle 声明
- 官方 package / plugin id / 安装说明

#### Scenario: Official reference plugin exposes slides capability
- **WHEN** 自托管安装并启用官方 reference slides plugin
- **THEN** `/v1/workspace/tools` SHALL 暴露 `SLIDES` tool
- **AND** 该 tool SHALL 携带完整 `config_schema` 与插件诊断元数据

