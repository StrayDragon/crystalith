# local-cache-draft-queue-and-sync-preflight 规范增量

## ADDED Requirements

### Requirement: Local Draft Queue MUST Be the Canonical Pending-Write Buffer
系统 MUST 将 local draft queue 作为所有本地待同步写入的唯一缓冲层，而不是让不同入口各自维护 pending state。

#### Scenario: 多个入口同时产生待同步对象
- **WHEN** browser capture、mobile capture 与 Notebook 编辑同时产生本地变更
- **THEN** 系统 SHALL 将这些变更收敛到同一 draft queue
- **AND** SHALL 为每项变更保留稳定的对象映射和同步状态

### Requirement: Sync Preflight MUST Classify Flush Attempts Before Sync
系统 MUST 在真正 flush draft queue 之前执行 sync preflight，并给出稳定的结果分类与风险摘要。

#### Scenario: 用户准备提交本地队列
- **WHEN** 系统或用户准备同步一批本地变更
- **THEN** 系统 SHALL 先返回 `silent_sync`、`confirm_required` 或 `blocked` 之一
- **AND** SHALL 提供冲突风险、依赖缺口、对象缺失或潜在覆盖的摘要
