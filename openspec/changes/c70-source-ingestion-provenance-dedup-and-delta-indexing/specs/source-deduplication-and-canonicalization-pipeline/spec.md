# source-deduplication-and-canonicalization-pipeline 规范增量

## ADDED Requirements

### Requirement: Sources MUST Resolve to Canonical Identity with Explainable Duplicate Signals
系统 MUST 为 source 建立 canonical identity 与可解释重复信号，而不是只凭零散字段做不可追踪的合并。

#### Scenario: 同一内容以不同入口重复导入
- **WHEN** 相同或近似内容通过不同 connector、路径或 URL 被多次导入
- **THEN** 系统 SHALL 识别 canonical source 与 duplicate candidates
- **AND** SHALL 保留解释这些候选为何相似的信号

### Requirement: Dedup Review Actions MUST Be Reversible
系统 MUST 让 dedup review 中的 merge、keep separate 或 park 动作可逆且可审计。

#### Scenario: 用户处理一组重复候选
- **WHEN** 用户对某个 duplicate group 执行 merge、ignore 或 park
- **THEN** 系统 SHALL 记录稳定的 action 结果与审计语义
- **AND** SHALL 支持后续回滚或重新评估
