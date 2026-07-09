# c19 design — 进程内任务队列

## 选型：进程内 vs 外部队列

桌面单二进制目标（`bun build --compile`）→ **进程内队列**，不引入 Redis/BullMQ（需外部进程，违背单二进制）。镜像 v1 `queue.py` 的 asyncio.PriorityQueue + Semaphore 设计。

## 核心数据结构

```ts
// shared/queue.ts
interface QueueEntry {
  taskId: number;
  priority: number; // 来自 payload.priority
  counter: number; // FIFO tiebreak（v1 itertools.count）
  signal: AbortSignal; // cancel 用
  resolve: (r: TaskResult) => void;
  reject: (e: Error) => void;
}

class TaskQueue {
  private heap: QueueEntry[] = []; // min-heap by [priority, counter]
  private counter = 0;
  private sem: Semaphore; // 并发 3

  async enqueue(payload: TaskPayload): Promise<number>; // 写 DB + 入队，返回 taskId
  async wait_for_completion(taskId: number): Promise<TaskResult>; // 等单个任务
  cancel(taskId: number): void; // AbortController.abort() + 状态 cancelled
  start_worker(): void; // 启动消费循环
}
```

## Semaphore（自写，避免依赖）

```ts
// shared/semaphore.ts
class Semaphore {
  private available: number;
  private waiters: (() => void)[] = [];
  constructor(count: number) {
    this.available = count;
  }
  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available--;
      return () => this.release();
    }
    return new Promise((resolve) => {
      this.waiters.push(() => {
        this.available--;
        resolve(() => this.release());
      });
    });
  }
  private release() {
    this.available++;
    this.waiters.shift()?.();
  }
}
```

## Worker 状态机（移植 v1 queue.py:184-229）

```
enqueue → INSERT tasks(status='pending') → 入 heap
worker pop → UPDATE status='running', progress=0
执行 task.fn(signal) → 成功: status='completed', result=...; 失败: status='failed', error=...
cancel(仅 pending 或运行中 signal.abort) → status='cancelled'
```

## 崩溃恢复

server.ts 启动时：

```ts
const stale = db().select().from(tasks).where(eq(tasks.status, 'running')).all();
for (const t of stale) {
  // 重排队（幂等）或标记 failed（取决于业务）
  db()
    .update(tasks)
    .set({ status: 'failed', error: 'interrupted by restart' })
    .where(eq(tasks.id, t.id))
    .run();
}
```

## StageLimiters（移植 v1 concurrency/limiters.py:65）

三个独立 Semaphore：embedding(并发限制)、vector_search、llm_generate。防止突发负载打爆下游。

## refine 接入

```ts
// refine/router.ts
const taskId = await queue.enqueue({ type: 'refine', payload, notebookId });
const result = await queue.wait_for_completion(taskId); // 阻塞 HTTP 直到完成
// 409 if result.cancelled
```

## 验证

- tasks BDD：任务创建/查询/cancel
- 单元测试：队列并发（3 个任务同时跑）、cancel 真中断、崩溃恢复（mock running 任务）

## DRIFT 低优先项处置

- **源摄取 readiness 语义**（DRIFT P1-6）：v1 是"解析+嵌入+向量化全完成才 READY"，v2 当前是"先标 READY，嵌入 fire-and-forget"。本 change 把 document_parse 接入队列后，摄取改为：解析完成→status=processing（task running）→嵌入完成→status=ready。前端轮询 task 进度，避免"ready 但检索空"。task 完成时才将 source 标 ready。
