## ADDED Requirements

### Requirement: Workspace tools expose a complete config_schema
`/v1/workspace/tools` 返回的工具对象 MUST 包含可直接驱动 UI 的 `config_schema`（如支持主题、数量/难度选项与默认值）。

#### Scenario: Studio UI renders from tools list only
- **WHEN** 客户端请求 `/v1/workspace/tools`
- **THEN** 返回的每个 tool SHALL 包含其 `config_schema`（若该 tool 支持配置）
- **AND** UI SHALL 能仅依赖该响应渲染配置弹窗而无需额外请求

### Requirement: Tool config endpoint stays consistent (if present)
若 `/v1/workspace/tools/{tool_id}/config` 端点存在，其返回值 MUST 与 tools 列表中的 `config_schema` 语义一致。

#### Scenario: Config endpoint matches config_schema
- **WHEN** 客户端请求 `/v1/workspace/tools/{tool_id}/config`
- **THEN** 返回的选项集合与默认值语义 SHALL 与对应 tool 的 `config_schema` 一致
