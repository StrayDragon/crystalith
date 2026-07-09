# add-v2-task-queue — Tasks

## 1. 核心数据结构

- [x] 新建 `shared/semaphore.ts`: Semaphore 类（acquire/release，~15 行）
- [x] 新建 `shared/queue.ts`: TaskQueue（min-heap + enqueue/wait_for_completion/cancel/start_worker）
- [x] 验证: `bun test test/queue/semaphore.test.ts`（并发 acquire/release 顺序）

## 2. Worker 状态机

- [x] 新建 `features/tasks/worker.ts`: runTask dispatch by type (refine, document_parse)
- [x] StageLimiters: embedding(2) / vector_search(4) / llm_generate(3) Semaphores
- [x] tasks router cancel 使用 TaskQueue.cancel 代替直接 DB update
- [x] 验证: `bun test test/queue/worker.test.ts`（pending→running→completed/failed/cancelled）

## 3. 崩溃恢复

- [x] `server.ts`: recoverStaleTasks 在启动时扫描 status='running' → 标记 failed('interrupted by restart')
- [x] startWorker 在 server.ts 启动
- [x] 验证: mock running 任务，重启后状态正确

## 4. Refine 接入队列 ✅

- [x] `features/refine/router.ts`: 改为使用 task queue（factory 函数接收 taskQueue，enqueue + waitForCompletion）
- [ ] 验证: `bun test test/refine/`（refine 经队列执行）

## 5. 文档解析异步化 ⚠️（等待 content storage layer）

- [ ] `features/sources/pipeline.ts`: 大文件摄取异步化（入队 document_parse）
- [ ] worker.ts 中 document_parse handler 已 stub（缺 storage.ts）
- [ ] 验证: 大文件摄取返回 task_id，可轮询进度

## 6. 整体验证

- [x] `cd apps/server && bun test tests/bdd/`（tasks BDD：创建/查询/cancel 全绿）
- [x] `cd apps/server && bun test test/queue/`（队列单元测试全绿）
- [x] `bun oxlint apps/server/src/shared/queue.ts apps/server/src/features/tasks/`（0 error）

## Verification

```bash
cd apps/server
bun test tests/bdd/          # tasks BDD
bun test test/queue/         # 队列/worker 单元测试
bun oxlint apps/server/src/shared/queue.ts apps/server/src/features/tasks/
```
