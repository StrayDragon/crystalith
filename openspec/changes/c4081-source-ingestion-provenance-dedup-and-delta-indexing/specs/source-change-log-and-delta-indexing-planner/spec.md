# source-change-log-and-delta-indexing-planner 规范增量

## ADDED Requirements

### Requirement: Source Changes MUST Be Recorded as a Stable Change Log
系统 MUST 将 source 变化落为稳定的 change log，而不是让刷新 planner 直接读取分散事件。

#### Scenario: source 的内容、元数据或标签发生变化
- **WHEN** 某个 source 被更新、删除或重新解析
- **THEN** 系统 SHALL 记录对应的 change log 条目
- **AND** 该条目 SHALL 区分 content、meta、tags 或 delete 等变化类型

### Requirement: Delta Plans MUST Distinguish Metadata-only from Content-changing Refreshes
系统 MUST 让 delta indexing plan 区分只改元数据和真正改内容的情况，而不是一律触发全量重建。

#### Scenario: source 只更新标签或标题
- **WHEN** planner 根据 change log 生成 delta indexing plan
- **THEN** 系统 SHALL 能仅刷新受影响的域
- **AND** SHALL 避免把 metadata-only 变化升级成 chunks/vector 全量 rebuild
