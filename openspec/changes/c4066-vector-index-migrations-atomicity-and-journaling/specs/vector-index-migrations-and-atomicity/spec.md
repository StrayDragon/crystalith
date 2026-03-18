# vector-index-migrations-and-atomicity 规范增量

## ADDED Requirements

### Requirement: Vector Writes MUST Be Staged Before Commit
系统 MUST 先将向量写入 staging generation，再通过显式 commit/swap 使其对读取可见。

#### Scenario: 构建中的新 generation 不影响在线读取
- **WHEN** 系统正在为某个 source 或 notebook 写入新 generation
- **THEN** 读路径 SHALL 继续看到当前 active generation
- **AND** 未提交的 staging 写入 SHALL 不可见

### Requirement: Deletions MUST Use Tombstones Before Compaction
系统 MUST 先以 tombstone 表达删除或替换，再由 compaction 在保留窗口外清理物理数据。

#### Scenario: 替换旧向量时保留历史快照
- **WHEN** 某批旧向量被新 generation 替换
- **THEN** 系统 SHALL 先写 tombstone 或等价删除标记
- **AND** 历史快照 SHALL 仍可用于调试或回滚窗口

### Requirement: Consistency Audits MUST Classify Missing, Orphan, and Drifted Entries
系统 MUST 提供向量一致性审计，并区分 missing、orphan 与 drifted 三类结果。

#### Scenario: 审计某个来源的向量状态
- **WHEN** 系统对某个 source 或 notebook 执行审计
- **THEN** 输出 SHALL 能区分 missing、orphan 与 drifted
- **AND** SHALL 为每类结果提供修复或清理建议
