## ADDED Requirements

### Requirement: Plugin compatibility failures are diagnosable
当插件因版本不兼容或合规问题被跳过时，系统 MUST 提供结构化、可机器读取的诊断信息。

#### Scenario: Compliance checker reports skipped plugin reason
- **WHEN** 插件被判定为不兼容或不合规而无法加载
- **THEN** 系统 SHALL 在日志或合规报告中给出稳定 `error_code` 与人类可读 `message`
- **AND** SHALL 提供可执行的修复建议（hint）

### Requirement: Compatibility policy is explicit and stable
宿主 MUST 明确声明支持的 `api_version` 集合，并对不兼容插件实施门禁，避免静默生效或静默失效。

#### Scenario: Block incompatible api_version
- **WHEN** 插件声明的 `api_version` 不在宿主支持集合内
- **THEN** 系统 SHALL 阻止插件生效并输出明确原因
