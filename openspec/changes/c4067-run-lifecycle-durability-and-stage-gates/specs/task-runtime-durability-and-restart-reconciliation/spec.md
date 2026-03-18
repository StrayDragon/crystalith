# task-runtime-durability-and-restart-reconciliation 规范增量

## ADDED Requirements

### Requirement: Running Tasks MUST Hold a Lease or Heartbeat
系统 MUST 为运行中的任务记录 worker lease 或 heartbeat，用于判断 worker 是否仍然存活。

#### Scenario: worker 丢失后任务进入可恢复状态
- **WHEN** 某个运行中任务的 lease 过期且没有新的 heartbeat
- **THEN** 系统 SHALL 将该任务标记为需要 reconciliation 的异常状态
- **AND** SHALL 提供恢复、重排或清理建议

### Requirement: Restart Reconciliation MUST Be Deterministic
系统 MUST 在服务重启后对 lease 过期的运行中任务执行确定性对账，而不是保持悬挂状态。

#### Scenario: 服务重启后扫描运行中任务
- **WHEN** worker 或服务实例启动并执行 restart reconciliation
- **THEN** 系统 SHALL 识别 lease 过期的运行中任务
- **AND** SHALL 将其转入可解释的恢复状态，而不是继续显示为正常运行

### Requirement: Stage-gated Runs MUST Survive Reconciliation
系统 MUST 让处于 checkpoint/gate 的 run 在重启对账后仍保持可解释且可继续。

#### Scenario: 重启发生在等待审批阶段
- **WHEN** 某个 run 在 checkpoint 或 approval gate 等待期间服务重启
- **THEN** 系统 SHALL 在对账后保留该 gate 的上下文
- **AND** SHALL 允许用户继续、回退或取消，而不是丢失该阶段信息
