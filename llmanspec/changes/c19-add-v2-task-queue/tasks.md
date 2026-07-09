# add-v2-task-queue — Tasks

## 1. 队列核心

- [ ] 新建 `shared/semaphore.ts`: Semaphore 类（acquire/release，~15 行）
- [ ] 新建 `shared/queue.ts`: TaskQueue（min-heap + enqueue/wait_for_completion/cancel/start_worker）
- [ ] 验证: `bun test test/queue/semaphore.test.ts`（并发 acquire/release 顺序）

## 2. Worker + 状态机

- [ ] 新建 `features/tasks/worker.ts`: 按 type 分派（refine/document_parse），状态机写入 tasks 表
- [ ] `features/tasks/router.ts`: cancel 用 AbortController 真中断（非仅改 status）
- [ ] StageLimiters: embedding/vector_search/llm_generate 三 Semaphore
- [ ] 验证: `bun test test/queue/worker.test.ts`（pending→running→completed/failed/cancelled）

## 3. 崩溃恢复

- [ ] `server.ts`: 启动时扫描 status='running' 标记 failed('interrupted by restart')
- [ ] 验证: mock running 任务，重启后状态正确

## 4. refine 接入队列

- [ ] `features/refine/router.ts`: enqueue → wait_for_completion → 返回（409 on cancelled）
- [ ] 验证: `bun test test/refine/`（refine 经队列执行）

## 5. document_parse 接入

- [ ] `features/sources/pipeline.ts`: 大文件摄取异步化（入队 document_parse）
- [ ] 验证: 大文件摄取返回 task_id，可轮询进度

## 6. 整体验证

- [ ] `cd apps/server && bun test tests/bdd/`（tasks BDD：创建/查询/cancel 全绿）
- [ ] `cd apps/server && bun test test/queue/`（队列/worker/崩溃恢复单元测试）
- [ ] `bun oxlint apps/server/src/shared/queue.ts apps/server/src/features/tasks/`（0 error）

## Verification

```bash
cd apps/server
bun test tests/bdd/    # tasks 域 BDD 全绿
bun test test/queue/   # semaphore + worker + 崩溃恢复
bun oxlint apps/server/src/shared/ apps/server/src/features/tasks/
```
