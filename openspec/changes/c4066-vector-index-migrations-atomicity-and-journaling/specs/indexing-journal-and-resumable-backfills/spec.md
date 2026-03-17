# indexing-journal-and-resumable-backfills 规范增量

## ADDED Requirements

### Requirement: Indexing Journal MUST Record Stage and Version Summary
系统 MUST 为索引构建记录阶段、版本摘要、耗时、失败分类与恢复提示。

#### Scenario: 查看一次 backfill 运行到哪一步
- **WHEN** 用户或开发者查看某次索引任务
- **THEN** 系统 SHALL 返回当前 stage、版本摘要与最近失败原因
- **AND** SHALL 提供 recovery_hint 或下一步动作

### Requirement: Resumable Backfill MUST Verify Version Compatibility
系统 MUST 仅在版本摘要兼容时允许从中间阶段继续，而不是盲目续跑。

#### Scenario: chunking 版本变化导致不能续跑
- **WHEN** 新一轮 backfill 的 chunking_version 或 embedding_model_id 与旧 journal 不一致
- **THEN** 系统 SHALL 拒绝从中间阶段继续
- **AND** SHALL 指示需要从更早阶段或全量重跑

### Requirement: Time-travel Debug MUST Be Bounded
系统 MUST 支持有限历史 generation 的 pin/read 调试，但必须受保留窗口与存储上限约束。

#### Scenario: 调试时读取历史 generation
- **WHEN** 开发者在允许的保留窗口内请求某个历史 generation
- **THEN** 系统 SHALL 返回该 generation 的调试读取结果
- **AND** 超出保留窗口时 SHALL 返回明确不可用说明
