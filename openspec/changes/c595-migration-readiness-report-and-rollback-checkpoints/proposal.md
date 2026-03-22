## Why

迁移和结构调整最怕两件事：不知道现在够不够条件开始做，以及一旦做坏了退不退得回去。没有就绪报告和回滚检查点，很多必要整理都会被一直往后拖。

## What Changes

- 定义 migration readiness report，对关键对象、schema、索引和回归状态做迁移前检查。
- 支持 rollback checkpoint，在高风险变更前留下可回退的最小检查点。
- 区分可自动回退和只能人工修复的变更类型，避免制造假安全感。
- 让迁移就绪报告不只服务一次性大迁移，也服务日常中等规模重构。

## Capabilities

### New Capabilities
- `migration-readiness-report-and-rollback-checkpoints`: 定义迁移就绪报告、回滚检查点和风险分层语义。

### Modified Capabilities
- `schema-snapshot-catalog-and-regression-baselines`: 就绪报告需要消费快照基线。
- `workspace-backup-migration-and-recovery`: 回滚检查点需要和恢复能力对齐。
- `quality-and-regression`: 迁移前后需要挂回归结果。

## Impact

- Backend：会影响迁移检查、检查点生成和回滚元数据。
- Frontend：会影响维护入口和就绪报告展示。
- Dependencies：这条线是维护层的收口件，把前面的快照、回归和恢复串起来。
