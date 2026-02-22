# background-task-queue Specification

## Purpose

定义后台任务队列（TaskQueue）的生命周期与资源安全：waiter 的惰性创建/释放、worker 停止语义与 in-flight 任务收敛、终态等待行为，以及后台任务与前台一致的并发/重试/取消护栏。

## Related specs

- `GLOSSARY.md`
- `backend-module-structure/spec.md`
- `backend-performance/spec.md`
- `generation-observability/spec.md`

## Requirements
### Requirement: Lazy task completion waiters
系统 MUST 仅在调用 `wait_for_completion(task_id)` 时创建任务完成 waiter，并在任务进入终态（`completed|failed|cancelled`）后释放 waiter，避免长期运行导致内存缓慢增长。
最小行为：
- 未调用 `wait_for_completion` 的任务 MUST NOT 创建/保留 completion waiter
- 调用 `wait_for_completion` 时可惰性创建 waiter；任务进入终态后 MUST 释放对应 waiter

### Requirement: Graceful worker shutdown
系统 MUST 在 `stop_worker()` 返回前停止队列主循环，并取消/等待所有 in-flight worker 任务，确保不会在依赖资源（DB/vector store 等）关闭后仍有后台任务继续执行。
`stop_worker()` 返回后 MUST 不再存在由 TaskQueue 创建的后台 worker 任务。

### Requirement: Terminal wait behavior
系统 MUST 在任务已处于终态时，使 `wait_for_completion(task_id)` 立即返回，不依赖 waiter 的存在与否。

### Requirement: Background Tasks Use the Same Guardrails
系统 MUST 确保后台任务队列（如 refine 生成队列）同样遵循并发限制与重试/取消策略，避免与前台请求互相挤占资源。
例如配置 LLM generation 并发上限为 N 时，后台队列同时执行多个生成任务也 MUST 限制实际并发不超过 N。
