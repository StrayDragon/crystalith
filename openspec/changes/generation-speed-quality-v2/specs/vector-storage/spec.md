## ADDED Requirements

### Requirement: Batch vector search
系统 SHOULD 支持批量向量检索接口（`search_many`），以一次调用处理多个 query 向量并返回分组结果，减少高延迟向量后端的调用开销。

#### Scenario: 批量搜索返回分组结果
- **WHEN** 调用 vector store 的 `search_many` 传入多个 `query_vectors`
- **THEN** 返回值为与输入等长的结果列表（list[list[VectorSearchResult]]）
- **AND** 每个位置的结果组仅对应同位置的 query 向量

#### Scenario: 空 query 向量返回空组
- **WHEN** `search_many` 的某个 query 向量为空或维度不匹配
- **THEN** 返回结果中对应位置为一个空列表
