# chunk-revision-ids-and-delta-rechunking 规范增量

## ADDED Requirements

### Requirement: Chunk Identity MUST Separate Logical Chunk IDs from Revision IDs
系统 MUST 将 chunk 的逻辑身份与版本身份分开表示，而不是让一次轻微变更把整个 chunk identity 重置掉。

#### Scenario: source 正文小范围变化
- **WHEN** source 内容更新仅影响部分 chunk
- **THEN** 系统 SHALL 能保留未变化 chunk 的逻辑 identity
- **AND** 对变化部分 SHALL 生成新的 revision

### Requirement: Delta Rechunking MUST Reuse Unchanged Chunk Revisions Conservatively
系统 MUST 在可安全复用时复用 chunk revisions，而不是每次都全量重切块。

#### Scenario: 旧版本与新版本存在大部分相同文本
- **WHEN** 系统比较旧 chunk 集与新归一化文本
- **THEN** 系统 SHALL 识别可复用的 chunk revisions
- **AND** SHALL 仅为新增或变更部分生成新 revisions
- **AND** 下游索引刷新 SHALL 优先消费这些 delta 结果
