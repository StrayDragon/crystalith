# api-shape-consolidation-and-generated-client-slimming 规范增量

## ADDED Requirements

### Requirement: API Objects MUST Use Stable Tiered Shapes
系统 MUST 将对外返回对象收口到稳定的 tiered shapes，而不是允许同类对象在不同 endpoint 下持续分叉。

#### Scenario: 同一资源在列表与详情中返回不同层级对象
- **WHEN** 系统同时暴露某个资源的列表、详情与操作结果
- **THEN** 列表 SHALL 返回稳定的 `list item` 形状
- **AND** 详情 SHALL 返回稳定的 `detail` 形状
- **AND** 操作结果 SHALL 复用定义好的 `action result` 边界，而不是重新发明字段层级

### Requirement: Generated Clients MUST Target Canonical DTO Boundaries
系统 MUST 让 generated client 基于 canonical DTO boundaries 消费 API，而不是要求前端为每个 endpoint 维护局部 shape glue。

#### Scenario: 前端新增非流式 API 调用
- **WHEN** 前端接入一个新的非流式 endpoint
- **THEN** generated client SHALL 直接暴露稳定 DTO
- **AND** 调用方 SHALL 不需要再为同类对象编写额外的字段重命名或层级拼装逻辑
