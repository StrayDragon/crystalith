## ADDED Requirements

### Requirement: Batch Source Operations
系统 SHALL 支持批量 source 操作，包括批量删除和批量 re-embed。批量操作 MUST 通过专用 API 端点提供。

#### Scenario: 批量删除 source
- **WHEN** 请求 DELETE /v1/notebooks/{id}/sources/batch，body 包含 source_ids 列表
- **THEN** 所有指定的 source 及其 chunks 被删除，向量存储中对应数据被清理

#### Scenario: 批量 re-embed
- **WHEN** 请求 POST /v1/notebooks/{id}/sources/batch/re-embed，body 包含 source_ids 列表
- **THEN** 所有指定 source 的 chunks 重新进行嵌入计算

### Requirement: Source Tagging
系统 SHALL 支持为 source 添加标签。每个 notebook 下的标签 MUST 唯一。Source 列表 SHALL 支持按标签筛选。

#### Scenario: 为 source 添加标签
- **WHEN** 为一个 source 添加标签 "论文"
- **THEN** source 关联该标签，按 "论文" 标签筛选时该 source 出现在结果中

#### Scenario: 按标签筛选
- **WHEN** 请求 source 列表并指定 tag 筛选参数
- **THEN** 仅返回包含该标签的 source
