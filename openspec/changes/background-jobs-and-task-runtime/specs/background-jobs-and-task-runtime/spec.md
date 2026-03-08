# background-jobs-and-task-runtime 规范增量

## ADDED Requirements

### Requirement: 后台任务必须使用统一生命周期
系统 MUST 以统一的后台任务生命周期表达长时操作，而不是让每个业务流程各自定义状态集合。

#### Scenario: 创建并执行一个长任务
- **WHEN** 系统启动一个需要异步执行的任务
- **THEN** 该任务 SHALL 进入统一生命周期
- **AND** v1 的生命周期 SHALL 固定为 `queued`、`running`、`succeeded`、`failed`、`cancelled`

### Requirement: 后台任务必须暴露进度、事件与历史
系统 MUST 为后台任务提供可查询的进度、关键事件与历史记录语义。

#### Scenario: 客户端查询任务执行状态
- **WHEN** 客户端查看某个后台任务
- **THEN** 系统 SHALL 返回任务当前状态、进度摘要和关键事件
- **AND** 任务完成后 SHALL 保留可查询的历史记录与结果摘要

### Requirement: 后台任务必须支持显式取消与重试
系统 MUST 把取消与重试定义为后台任务的稳定动作，而不是依赖客户端自行重建流程。

#### Scenario: 用户取消或重试后台任务
- **WHEN** 用户对一个后台任务执行取消或重试
- **THEN** 系统 SHALL 以任务动作为单位处理请求
- **AND** 取消 SHALL 只作用于进行中的任务
- **AND** 重试 SHALL 表达为对同一任务定义的重新执行
