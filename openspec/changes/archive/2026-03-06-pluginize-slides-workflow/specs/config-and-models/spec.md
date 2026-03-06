# config-and-models Specification (Delta)

## ADDED Requirements

### Requirement: Active slides workflow plugin is configurable via YAML
系统 MUST 通过 YAML 提供 active slides workflow plugin 的选择配置（例如 `slides.default_plugin` 或等价字段），并以 schema 校验其结构。

规则：

- 当该字段已设置时，宿主 MUST 优先选择该 plugin id 作为 active slides workflow plugin
- 当该字段指向未加载、被禁用或不兼容的插件时，系统 MUST 返回结构化诊断
- 当该字段未设置时，宿主仅可在“恰好发现一个兼容 slides plugin”时自动选择

#### Scenario: Operator pins a default slides plugin
- **WHEN** 运维在配置中设置 `slides.default_plugin="slides-slidev"`
- **THEN** 系统 SHALL 将该 plugin id 作为唯一默认候选
- **AND** 若该插件不可用，系统 SHALL 给出明确恢复提示而不是静默回退到其他插件

