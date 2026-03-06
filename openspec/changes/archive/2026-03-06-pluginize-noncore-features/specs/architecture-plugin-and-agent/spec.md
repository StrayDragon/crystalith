# architecture-plugin-and-agent Specification (Delta)

## MODIFIED Requirements

### Requirement: Plugin discovery uses entry points
插件发现 MUST 通过 `entry_points` 完成；插件注册冲突采用 last-wins（以“接口 key”为粒度，如 output_type / parser_type / extractor_type），且加载顺序 MUST 可预测：

- 启用插件 MUST 以确定性顺序加载（默认按 `plugin_id` 字典序）。
- 若配置了 `plugins.load_order`，宿主 MUST 按该顺序将对应插件移动到加载序列末尾，使其在冲突裁决中拥有更高优先级。

宿主 MUST 记录每个已注册 key 的“最终生效插件 id/entry point”，以便在 tools / extractors 等对外诊断中解释能力来源与覆盖关系。

#### Scenario: Discover plugins at runtime
- **WHEN** 系统启动并加载可用插件
- **THEN** 插件 SHALL 通过 `entry_points` 被发现
- **AND** 当多个插件声明同一 key 时，系统 SHALL 按 last-wins 规则确定生效项
- **AND** 系统 SHALL 记录生效项对应的 plugin id/entry point 以用于可诊断输出

## ADDED Requirements

### Requirement: Plugin enable policy is evaluated before importing plugins
在加载 entry point 对象前，宿主 MUST 先依据 `plugins.enabled/disabled` 判定插件是否启用；被禁用插件 MUST NOT 被 import/初始化，以避免不必要的重依赖与副作用。

#### Scenario: Disabled plugin is skipped without import
- **WHEN** 某插件 id 被 `plugins.disabled` 禁用（或不在 allowlist 中）
- **THEN** 系统 SHALL 跳过该 entry point 的 import 与初始化
- **AND** SHALL 输出结构化诊断信息说明其被禁用与恢复提示

### Requirement: WebExtractorPlugin is supported as a first-class interface
宿主 MUST 支持 `WebExtractorPlugin`（或等价接口）作为一类可被发现与装配的插件接口，并将其与 `OutputTypePlugin` / `ParserPlugin` 一样纳入兼容性门禁与可诊断失败语义。

#### Scenario: Load extractor plugins with compatibility gates
- **WHEN** 系统启动并发现一个实现 `WebExtractorPlugin` 的插件
- **THEN** 系统 SHALL 校验其 `api_version` 与宿主支持集合兼容
- **AND** 兼容时 SHALL 注册为可用提取器实现
- **AND** 不兼容或依赖缺失时 SHALL 跳过并输出稳定 error_code/message/hint
