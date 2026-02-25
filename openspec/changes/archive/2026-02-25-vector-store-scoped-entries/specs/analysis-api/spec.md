# analysis-api (delta) Specification

## ADDED Requirements

### Requirement: Analysis MUST not load vector entries from other notebooks
系统 MUST 在分析单个 notebook 时仅加载该 notebook 的向量条目，且 MUST NOT 为了过滤而先加载其他 notebook 的 entries。

#### Scenario: Analysis isolates notebook vector entries
- **WHEN** 请求 `GET /v1/notebooks/{notebook_id}/analysis`
- **THEN** 系统仅读取 `{notebook_id}` 的向量条目并生成结果
