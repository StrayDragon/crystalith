# source-ingestion-contracts-dedup-and-chunking 规范增量

## ADDED Requirements

### Requirement: Source Ingestion MUST Follow Explicit Stage Contracts
系统 MUST 让 source ingestion 通过显式阶段推进，而不是把抓取、提取、切块和索引混成不可解释的黑箱。

#### Scenario: 系统接入一个新 source
- **WHEN** 来源被导入、刷新或重试
- **THEN** 系统 SHALL 以 discover、fetch、extract、parse、chunk、embed、index 等稳定阶段处理
- **AND** 每个阶段 SHALL 产出可追踪 artifact 或状态

### Requirement: Ingestion MUST Support Partial Success and Stage-scoped Recovery
系统 MUST 支持步骤级恢复与部分成功，而不是默认整条 ingestion 全量重跑。

#### Scenario: 抓取成功但后续阶段失败
- **WHEN** source 在某个中间阶段失败
- **THEN** 系统 SHALL 明确记录失败阶段与最近成功阶段
- **AND** SHALL 支持按阶段重试或重入
- **AND** 若来源部分可用，SHALL 允许其以 partial success 形态进入工作台
