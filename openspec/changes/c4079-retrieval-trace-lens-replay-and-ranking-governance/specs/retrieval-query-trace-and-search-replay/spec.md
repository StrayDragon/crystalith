# retrieval-query-trace-and-search-replay 规范增量

## ADDED Requirements

### Requirement: Retrieval Runs MUST Emit a Replayable Trace and Snapshot Identifier
系统 MUST 为一次检索运行产出可解释的 trace 与稳定 `snapshot_id`，而不是只返回最终结果。

#### Scenario: 用户查看一次检索结果
- **WHEN** 系统完成一次 retrieval run
- **THEN** 系统 SHALL 记录 query、candidate、assembly 与 citation binding 的关键轨迹
- **AND** SHALL 为该次运行提供稳定的 `snapshot_id`

### Requirement: Replay MUST Explain Exact-versus-Approximate Reproducibility
系统 MUST 区分精确可回放与只能近似回放的检索结果。

#### Scenario: 用户尝试回放历史检索
- **WHEN** 某个 `snapshot_id` 被用于 replay
- **THEN** 系统 SHALL 说明该次 replay 是否能精确复现原结果边界
- **AND** 若只能近似回放，SHALL 给出差异原因摘要
