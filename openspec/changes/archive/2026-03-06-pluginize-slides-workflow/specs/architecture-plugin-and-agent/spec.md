# architecture-plugin-and-agent Specification (Delta)

## ADDED Requirements

### Requirement: SlidesWorkflowPlugin is supported as a first-class interface
宿主 MUST 将 `SlidesWorkflowPlugin`（或等价接口）作为与 `AIProviderPlugin`、`ParserPlugin`、`OutputTypePlugin`、`WebExtractorPlugin` 并列的一类插件接口，纳入统一的发现、兼容性门禁、启用策略与可诊断失败语义。

#### Scenario: Discover slides workflow plugins at runtime
- **WHEN** 系统启动并扫描 `crystalith.plugins` entry points
- **THEN** 实现 `SlidesWorkflowPlugin` 的插件 SHALL 被识别为 slides workflow 候选
- **AND** SHALL 应用与其他插件一致的 api_version / enablement / load error 校验

### Requirement: Active slides plugin selection is diagnosable
当 slides workflow plugin 的最终生效项无法唯一确定时，宿主 MUST 输出稳定的结构化诊断，而不是静默选择某一个插件。

#### Scenario: Ambiguous slides workflow selection is reported
- **WHEN** 存在多个兼容的 slides workflow plugin 且默认插件未配置
- **THEN** 系统 SHALL 输出稳定 error_code / message / hint / details
- **AND** SHALL 记录候选 plugin id 列表与建议选择方式

