# api-list-contracts-pagination-filtering-and-field-sets 规范增量

## ADDED Requirements

### Requirement: List Endpoints MUST Use a Shared Cursor Contract
系统 MUST 让高增长对象列表共享统一的 cursor pagination、排序、过滤与响应 envelope。

#### Scenario: 客户端请求列表第一页或下一页
- **WHEN** 客户端请求 sources、sessions、outputs、tasks 或等价对象列表
- **THEN** 请求 SHALL 使用统一的 `limit`、`cursor`、`sort_by`、`sort_order` 与规范化 filter 字段
- **AND** 响应 SHALL 返回 `{ items, next_cursor, meta }` 的稳定 envelope

### Requirement: Fieldset Presets MUST Be First-class Contract
系统 MUST 将 fieldset presets 作为正式契约，而不是让每个页面自行拼接字段集合。

#### Scenario: 页面请求 bootstrap、列表或详情字段集
- **WHEN** 客户端请求同一资源的不同读取场景
- **THEN** 系统 SHALL 支持稳定的 `bootstrap`、`list`、`detail` 等 fieldset presets
- **AND** 不同 endpoint SHALL 复用相同 preset 语义，而不是为相似场景定义不兼容字段集合

### Requirement: List Meta MUST Preserve Deterministic Query Semantics
系统 MUST 在列表响应的 `meta` 中回显足够的查询语义，以支持稳定缓存和可解释回放。

#### Scenario: 客户端需要复用同一查询语义
- **WHEN** 客户端收到列表响应
- **THEN** `meta` SHALL 至少反映生效的 sort、filters 与生成时间等关键信息
- **AND** 同一查询条件下的返回顺序 SHALL 可复现
