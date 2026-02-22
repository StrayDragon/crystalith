# plugin-system Specification

## Purpose

定义 Crystalith 的插件发现、加载与注册规则：通过 Python entry points 自动发现插件，并在运行时根据 `plugins.enabled/disabled` 决定是否加载。插件用于扩展：

- AI provider（chat/embedding）
- Parser（来源解析/提取）
- Output type（结构化输出 schema/prompt，以及可选的 UI 元数据）

本规范强调“启动期注册 + 运行时宽容”：插件不应导致核心应用启动或生成链路崩溃；不兼容或不合规的可选扩展字段会被忽略并记录日志。

## Related specs

- `GLOSSARY.md`
- `config-management/spec.md`
- `ai-provider-config/spec.md`
- `source-ingestion/spec.md`
- `output-graph/spec.md`
- `output-rendering/spec.md`
- `workspace-api/spec.md`

## Requirements

### Requirement: Plugin discovery via entry_points
系统 MUST 通过 Python entry_points group `crystalith.plugins` 发现插件。entry point 的 `name` 作为 `plugin_id`（配置、日志与冲突处理的唯一标识）。
加载规则：
- `plugins.enabled` 非空时视为 allowlist：仅加载列表中的 `plugin_id`
- `plugins.enabled` 为空时，`plugins.disabled` 为 denylist：命中则跳过且不注册任何能力

### Requirement: Optional api_version compatibility gate
插件 MAY 暴露 `api_version` 字段声明与核心插件 API 的兼容性。若提供，系统 MUST 要求其等于 `v1`；否则跳过插件并记录 warning。

### Requirement: OutputTypePlugin registration is last-wins
当多个插件注册相同 `output_type` 时，系统 MUST 采用 last-wins 覆盖策略，并记录 warning。
冲突日志 MUST 包含 `existing_plugin_id` 与新的 `plugin_id`。

### Requirement: OutputTypePlugin optional extension attributes are lenient
`OutputTypePlugin` Protocol 仅要求 `output_type/schema/default_prompt`。插件 MAY 通过可选扩展字段增强前端体验：

- `metadata: OutputTypePluginMeta`（显示文案/色调）
- `render_descriptor: RenderDescriptor`（通用渲染布局描述；详见 `output-rendering/spec.md`）
- `config_schema: PluginConfigSchema`（生成对话框参数 schema）

系统 MUST 在注册时通过 `getattr()` 读取这些字段，并仅在类型正确时存入 registry；类型不正确时 MUST 忽略并记录 warning（运行时不抛错）。

### Requirement: render_types models are importable for plugins
系统 MUST 提供 `crystalith.shared.plugins.render_types` 模块，包含 `OutputTypePluginMeta/RenderDescriptor/PluginConfigSchema` 等 Pydantic model，供插件包直接依赖。
第三方插件导入该模块 MUST 成功且无需依赖后端应用的其它 feature 模块。

### Requirement: Compliance tooling is developer-facing
系统 SHOULD 提供插件合规检查工具（例如 `backend/py/scripts/check_plugins.py`）用于 CI/开发阶段报告问题，但运行时 registry 的行为 MUST 以“宽容注册 + 日志告警”为主。
