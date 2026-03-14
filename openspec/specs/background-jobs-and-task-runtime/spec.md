# background-jobs-and-task-runtime Specification

## Purpose

提供统一的后台任务运行时模型：生命周期、进度、事件与历史、取消与重试语义，以及创建/查询/操作的最小接口契约，供生成、导入、同步检查等长任务复用。

## Non-goals

- 不在 v1 定义复杂调度策略（优先级、公平性、配额等）
- 不统一所有业务工作流本身的语义与 UI

## Requirements

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

### Requirement: 系统必须提供任务的创建、查询、取消、重试与历史查看接口语义
系统 MUST 提供稳定的任务运行时接口，使不同业务流程都能以同一方式使用后台任务底座。

#### Scenario: 客户端创建一个后台任务
- **WHEN** 客户端提交一个 JobDefinition 创建任务
- **THEN** 系统 SHALL 返回任务标识与初始状态（至少为 `queued`）

#### Scenario: 客户端查询任务详情与历史
- **WHEN** 客户端查询某个任务
- **THEN** 系统 SHALL 返回任务状态、进度摘要、关键事件与结果/错误摘要
- **AND** 系统 SHALL 提供该任务的可查询历史（attempt 维度）

### Requirement: 任务结果必须提供结构化摘要与恢复提示
系统 MUST 为任务提供结构化结果摘要与错误摘要，并在失败时提供明确的恢复提示以支持统一 UI 展示。

#### Scenario: 任务成功完成
- **WHEN** 某个任务成功完成
- **THEN** 系统 SHALL 返回可用于 UI 展示的结果摘要

#### Scenario: 任务失败完成
- **WHEN** 某个任务失败完成
- **THEN** 系统 SHALL 返回结构化错误摘要
- **AND** 系统 SHALL 返回可读的恢复提示（recovery hint）

### Requirement: 工作区必须提供统一入口查看任务状态与历史
系统 MUST 在工作区提供统一入口查看后台任务列表、状态、进度与历史记录，避免每条长链路各自实现一套任务 UI。

#### Scenario: 用户在工作区查看任务中心
- **WHEN** 用户进入工作区的任务中心
- **THEN** 系统 SHALL 展示该工作区的任务列表（可按 status/type 过滤）
- **AND** 用户 SHALL 能查看某个任务的事件时间线与历史 attempts
