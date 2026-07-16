// TaskQueue — in-process priority queue mirroring v1 features/tasks/queue.py.
// Uses a min-heap (by [priority, counter]) + Semaphore for concurrency control.
// Tasks are persisted to the `tasks` table via the worker.
import { eq } from 'drizzle-orm';

import { db } from '../db/index.ts';
import { tasks } from '../db/schema.ts';
import { Semaphore } from './semaphore.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueueEntry {
  taskId: number;
  priority: number;
  // FIFO tie-break within same priority
  counter: number;
  signal: AbortSignal;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

export interface EnqueueOpts {
  type: 'refine' | 'document_parse';
  payload?: unknown;
  notebookId?: number;
  priority?: number;
}

// ---------------------------------------------------------------------------
// TaskQueue
// ---------------------------------------------------------------------------

export class TaskQueue {
  private heap: QueueEntry[] = [];
  private counter = 0;
  // max 3 concurrent
  private sem = new Semaphore(3);
  private aborted = false;
  private pendingResolve = new Map<number, (value: unknown) => void>();
  private pendingReject = new Map<number, (reason: Error) => void>();
  private entryMap = new Map<number, { ac: AbortController; entry: QueueEntry }>();

  /** Enqueue a task: insert DB row (pending), push to priority heap. Returns taskId. */
  enqueue(opts: EnqueueOpts): number {
    const row = db()
      .insert(tasks)
      .values({
        type: opts.type,
        notebookId: opts.notebookId ?? null,
        status: 'pending' as const,
        payload: (opts.payload ?? {}) as Record<string, unknown>,
        progress: 0,
      })
      .returning()
      .get();

    const ac = new AbortController();
    const entry: QueueEntry = {
      taskId: row.id,
      priority: opts.priority ?? 0,
      counter: this.counter++,
      signal: ac.signal,
      resolve: () => {},
      reject: () => {},
    };

    // Replace with real resolve/reject (set by waitForCompletion).
    this.entryMap.set(row.id, { ac, entry });
    this.heap.push(entry);
    this._siftUp(this.heap.length - 1);

    return row.id;
  }

  /** Wait for a task to complete. Resolves with the task result. */
  async waitForCompletion(taskId: number): Promise<unknown> {
    const stored = this.entryMap.get(taskId);
    if (!stored) {
      throw new Error(`Task ${taskId} not found`);
    }
    return new Promise<unknown>((resolve, reject) => {
      stored.entry.resolve = resolve;
      stored.entry.reject = reject;
      this.pendingResolve.set(taskId, resolve);
      this.pendingReject.set(taskId, reject);
    });
  }

  /** Cancel a task: abort signal + mark cancelled in DB. */
  cancel(taskId: number): boolean {
    const stored = this.entryMap.get(taskId);
    if (stored) {
      stored.ac.abort();
    }

    // Update DB status for pending/running tasks.
    const task = db().select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (
      task &&
      task.status !== 'completed' &&
      task.status !== 'failed' &&
      task.status !== 'cancelled'
    ) {
      db()
        .update(tasks)
        .set({ status: 'cancelled' as const })
        .where(eq(tasks.id, taskId))
        .run();
    }

    const rejectFn = this.pendingReject.get(taskId);
    if (rejectFn) {
      rejectFn(new Error('Task cancelled'));
    }

    this.entryMap.delete(taskId);
    this.pendingResolve.delete(taskId);
    this.pendingReject.delete(taskId);
    return true;
  }

  /** Start the worker consumption loop. Runs in background. */
  startWorker(dispatch: (taskId: number, signal: AbortSignal) => Promise<unknown>): void {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      while (!this.aborted) {
        const entry = this._pop();
        if (!entry) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }

        const release = await this.sem.acquire();
        try {
          db()
            .update(tasks)
            .set({ status: 'running' as const, progress: 5 })
            .where(eq(tasks.id, entry.taskId))
            .run();

          const result = await dispatch(entry.taskId, entry.signal);

          db()
            .update(tasks)
            .set({
              status: 'completed' as const,
              result: result as Record<string, unknown>,
              progress: 100,
            })
            .where(eq(tasks.id, entry.taskId))
            .run();

          const resolveFn = this.pendingResolve.get(entry.taskId);
          if (resolveFn) {
            resolveFn(result);
          }
        } catch (error) {
          const isAbort =
            entry.signal.aborted || (error instanceof Error && error.name === 'AbortError');
          db()
            .update(tasks)
            .set({
              status: isAbort ? ('cancelled' as const) : ('failed' as const),
              error: isAbort ? 'aborted' : String(error),
            })
            .where(eq(tasks.id, entry.taskId))
            .run();

          const rejectFn = this.pendingReject.get(entry.taskId);
          if (rejectFn) {
            rejectFn(error instanceof Error ? error : new Error(String(error)));
          }
        } finally {
          this.pendingResolve.delete(entry.taskId);
          this.pendingReject.delete(entry.taskId);
          this.entryMap.delete(entry.taskId);
          release();
        }
      }
    })();
  }

  /** Recover stalled running tasks on startup (crash recovery). */
  recoverStaleTasks(): void {
    const stale = db().select().from(tasks).where(eq(tasks.status, 'running')).all();
    for (const t of stale) {
      db()
        .update(tasks)
        .set({ status: 'failed' as const, error: 'interrupted by restart' })
        .where(eq(tasks.id, t.id))
        .run();
    }
  }

  // ------------------------------------------------------------------
  // Min-heap operations (min by [priority, counter])
  // ------------------------------------------------------------------

  private _pop(): QueueEntry | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  private _siftUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this._cmp(idx, parent) >= 0) break;
      this._swap(idx, parent);
      idx = parent;
    }
  }

  private _siftDown(idx: number): void {
    const len = this.heap.length;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let smallest = idx;
      const left = (idx << 1) + 1;
      const right = (idx << 1) + 2;
      if (left < len && this._cmp(left, smallest) < 0) smallest = left;
      if (right < len && this._cmp(right, smallest) < 0) smallest = right;
      if (smallest === idx) break;
      this._swap(idx, smallest);
      idx = smallest;
    }
  }

  private _swap(a: number, b: number): void {
    [this.heap[a], this.heap[b]] = [this.heap[b], this.heap[a]];
  }

  private _cmp(a: number, b: number): number {
    const x = this.heap[a];
    const y = this.heap[b];
    const pDiff = x.priority - y.priority;
    if (pDiff !== 0) return pDiff;
    return x.counter - y.counter;
  }
}
