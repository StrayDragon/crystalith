# config-and-models Specification (Delta)

## ADDED Requirements

### Requirement: Plugin enablement is configurable via YAML
系统 MUST 通过 `config/app.yaml` 提供插件启用策略配置（allowlist/denylist），并以 schema 校验其结构；插件启用策略 MUST 在启动时生效且可诊断。

#### Scenario: Allowlist loads only selected plugins
- **WHEN** 运维在配置中设置 `plugins.enabled=[\"output-quiz\", \"parser-pdf\"]`
- **THEN** 系统 SHALL 仅加载 allowlist 中存在且兼容的插件
- **AND** 对未加载插件 SHALL 提供结构化诊断信息（disabled/allowlist/missing_dependency 等）

### Requirement: Plugin diagnostics are stable and user-actionable
当插件因禁用/不兼容/依赖缺失/加载失败而被跳过时，系统 MUST 输出稳定的 error_code/message/hint/details，且 hint MUST 是用户可执行的恢复步骤（例如安装依赖、启用插件、升级版本）。

#### Scenario: Missing dependency produces a recovery hint
- **WHEN** 某插件因依赖缺失而加载失败
- **THEN** 系统 SHALL 标记该插件为 skipped 并给出 `missing_dependency`（或等价）error_code
- **AND** hint SHALL 指示如何安装缺失依赖与验证插件可导入

### Requirement: Plugin load order is configurable for deterministic tie-break
系统 MUST 在 `config/app.yaml` 中提供 `plugins.load_order: string[]`（可选）用于控制插件加载顺序，从而使冲突裁决可预测（例如多个 parser 插件同时命中同一文件类型）。

规则：
- 若 `plugins.load_order` 提供，则宿主 MUST 将列表中出现的、且“已发现且启用”的插件按该顺序加载到最后（拥有更高优先级）。
- 未出现在 `plugins.load_order` 的启用插件 MUST 按 `plugin_id` 字典序加载。
- 冲突裁决仍采用 last-wins，但由于加载顺序确定，最终生效项 MUST 可预测。

#### Scenario: Operator pins parser conflict resolution
- **WHEN** 运维设置 `plugins.load_order=[\"parser-pdf\", \"parser-html\"]`
- **AND** 存在多个 parser 插件同时声明支持某些类型
- **THEN** 系统 SHALL 以该加载顺序确定最终生效插件
- **AND** 诊断信息 SHALL 记录最终生效插件 id 以便排障
