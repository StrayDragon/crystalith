# background-task-queue Specification

## Purpose
TBD - created by archiving change maintainability-pass-2026-02-10. Update Purpose after archive.

## Requirements
### Requirement: Lazy task completion waiters
系统 MUST 仅在调用 `wait_for_completion(task_id)` 时创建任务完成 waiter，并在任务进入终态（COMPLETED/FAILED/CANCELLED）后释放 waiter，避免长期运行导致内存缓慢增长。

#### Scenario: 未等待的任务不创建 waiter
- **WHEN** TaskQueue 被用于 enqueue 多个任务，但调用方从未调用 `wait_for_completion`
- **THEN** TaskQueue 不为每个任务创建/保留 completion waiter
- **AND** 任务完成后不会在内存中残留与任务数量线性增长的 waiter 状态

#### Scenario: 等待完成后释放 waiter
- **WHEN** 调用方对某个 task_id 调用 `wait_for_completion` 并等待其完成
- **THEN** `wait_for_completion` 在任务进入终态后返回
- **AND** TaskQueue 释放该 task_id 的 waiter（后续不再占用内存）

### Requirement: Graceful worker shutdown
系统 MUST 在 `stop_worker()` 返回前停止队列主循环，并取消/等待所有 in-flight worker 任务，确保不会在依赖资源（DB/vector store 等）关闭后仍有后台任务继续执行。

#### Scenario: stop_worker 在任务执行中被调用
- **WHEN** 存在 RUNNING 的任务且调用 `stop_worker()`
- **THEN** `stop_worker()` 在返回前完成对 in-flight worker 任务的取消或收敛等待
- **AND** `stop_worker()` 返回后不再存在由 TaskQueue 创建的后台 worker 任务

### Requirement: Terminal wait behavior
系统 MUST 在任务已处于终态时，使 `wait_for_completion(task_id)` 立即返回，不依赖 waiter 的存在与否。

#### Scenario: 等待已完成任务
- **WHEN** task_id 对应任务已处于 COMPLETED/FAILED/CANCELLED
- **THEN** `wait_for_completion(task_id)` 立即返回

### Requirement: Background Tasks Use the Same Guardrails
系统 MUST 确保后台任务队列（如 refine 生成队列）同样遵循并发限制与重试/取消策略，避免与前台请求互相挤占资源。

#### Scenario: 队列任务遵循 limiter
- **GIVEN** 配置设置 LLM generation 并发上限为 N
- **WHEN** 后台队列同时执行多个生成任务
- **THEN** 系统 MUST 限制并发执行数不超过 N
