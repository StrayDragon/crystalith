# background-jobs-and-task-runtime 规范增量

## ADDED Requirements

### Requirement: Compute-Class Jobs MUST Declare Resource and Sandbox Profiles
系统 MUST 让 compute-class jobs 在进入后台任务运行时之前声明 resource profile 与 sandbox profile，而不是让任务运行时只知道“这是一个普通长任务”。

#### Scenario: 系统创建一个 compute job
- **WHEN** Notebook 或 agent flow 提交一个 compute-class job
- **THEN** 该任务 SHALL 声明其 resource profile 与 sandbox profile
- **AND** 任务运行时 SHALL 保留这些声明用于排队、调度、取消与审计

### Requirement: Compute-Class Jobs MUST Retain Structured Execution Records
系统 MUST 为 compute-class jobs 保留可恢复的结构化执行记录，而不是只保留最终成功或失败状态。

#### Scenario: 某个 compute job 中断后被查看或重试
- **WHEN** 用户或系统查询该任务的历史 attempt
- **THEN** 系统 SHALL 返回执行状态、关键事件和结构化结果摘要
- **AND** SHALL 能区分 kernel/runtime 失败、sandbox 拒绝和用户取消等不同终止原因
