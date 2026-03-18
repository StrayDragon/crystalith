# openapi-surface-cleanup-and-route-taxonomy 规范增量

## ADDED Requirements

### Requirement: Endpoints MUST Declare Stable Taxonomy Metadata
系统 MUST 为对外 endpoint 提供稳定的 taxonomy metadata，包括 tags、versioned path discipline 与 operationId 命名规则。

#### Scenario: 新增或调整对外 endpoint
- **WHEN** 系统新增一个 `/v1/**` endpoint
- **THEN** 该 endpoint SHALL 挂接到固定 taxonomy 下的 tag 集合
- **AND** SHALL 使用稳定且不冲突的 operationId 规则

### Requirement: New Routes MUST Not Bypass Error and Documentation Gates
系统 MUST 禁止新增 route 绕开错误契约与最小文档门禁。

#### Scenario: 新 router 进入 OpenAPI surface
- **WHEN** 某个 router 或 endpoint 被纳入 OpenAPI
- **THEN** 该 route SHALL 声明非 2xx 响应
- **AND** SHALL 复用统一错误 schema
- **AND** SHALL 不以散装 `detail` 作为默认错误契约

### Requirement: Taxonomy-breaking Surface Changes MUST Be Explicit
系统 MUST 将影响稳定 key 的 surface 变化显式记录，而不是隐式改名后让客户端自行发现。

#### Scenario: path 或 operationId 发生 breaking 调整
- **WHEN** 某个稳定 path、tag 或 operationId 必须重排
- **THEN** 变更 SHALL 显式列出 old → new 映射
- **AND** 相关 generated client 同步 SHALL 被视为同一批 contract 变更的一部分
