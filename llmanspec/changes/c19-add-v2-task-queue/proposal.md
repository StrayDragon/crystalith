---
depends_on: []
blocks:
  [
    c20-fix-v2-outputs-and-refine,
    c22-add-v2-research-agent,
    c13-add-v2-distribution,
    c14-add-v2-cleanup-delivery,
  ]
batch: all
---

# c19-add-v2-task-queue — 进程内任务队列

## Why

`docs/V1-V2-DRIFT-ANALYSIS.md` P0-2 揭示：v2 的 `tasks` 表存在，`GET /v2/tasks/:id` 能读，但**全代码库零 `insert(tasks)`**——任务系统读得到写不到。refine/outputs/research/摄取全是同步执行，前端任务轮询永远查不到任务。这是 v1→v2 迁移的"声明 vs 实现"鸿沟。

v1 有完整 `TaskQueue`（PriorityQueue + semaphore，并发 3，`queue.py`）+ worker（`worker.py`）。v2 需复刻进程内设计（桌面单二进制，不引入 Redis/BullMQ）。

## What Changes

- **NEW** `apps/server/src/shared/queue.ts` — 进程内优先队列（min-heap + Promise signaling），`enqueue`/`wait_for_completion`/`cancel`/`start_worker` API（镜像 v1 `queue.py`）
- **NEW** `apps/server/src/shared/semaphore.ts` — Semaphore 并发控制（~15 行自写，或 `p-limit`），StageLimiters（embedding/vector_search/llm_generate 三限流器）
- **NEW** `apps/server/src/features/tasks/worker.ts` — 任务 worker：按 type 分派（refine/document_parse），状态机写入（pending→running→completed/failed/cancelled）
- **MODIFIED** `apps/server/src/features/tasks/router.ts` — cancel 真中断运行中任务（AbortController），非仅改 status
- **MODIFIED** `apps/server/src/server.ts` — 启动时调 `startWorker()` + 扫描 `status='running'` 重排队（崩溃恢复）
- **MODIFIED** `apps/server/src/features/refine/router.ts` — refine 接入队列（enqueue → wait_for_completion → 返回，409 on cancelled）
- **MODIFIED** `apps/server/src/features/sources/pipeline.ts` — document_parse（大文件摄取）接入队列异步化

## Capabilities

- background-jobs-and-task-runtime (spec delta: 队列实现 + 状态机 + 崩溃恢复)

## Impact

- `tasks` 表被正确写入，前端任务轮询可用
- refine/大文件摄取异步化，不阻塞 HTTP 请求
- 崩溃恢复：重启后 running 状态任务重排队
- cancel 真中断运行中任务
