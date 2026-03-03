# workspace-api-contract Specification (Delta)

## ADDED Requirements

### Requirement: Workspace tools can expose frontend_bundle descriptor
`/v1/workspace/tools` 返回的 tool 对象 MUST 支持可选字段 `frontend_bundle`，用于声明该输出类型的前端渲染 bundle。

#### Scenario: Tools response includes optional frontend_bundle
- **WHEN** 客户端请求 `/v1/workspace/tools`
- **THEN** 每个 tool 对象 MAY 包含 `frontend_bundle`
- **AND** `frontend_bundle` 缺省或为 null 时 SHALL 表示该 tool 没有可用的前端 bundle
