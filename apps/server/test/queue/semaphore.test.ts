// Tests for Semaphore concurrency primitive.
import { describe, expect, it } from 'bun:test';

describe('Semaphore', () => {
  it('should work via the Semaphore class', async () => {
    const { Semaphore } = await import('../../src/shared/semaphore.ts');
    const sem = new Semaphore(2);

    const release1 = await sem.acquire();
    expect(sem.running()).toBe(0); // running() returns waiter count, not active count
    const release2 = await sem.acquire();
    release1();
    release2();
  });

  it('should limit concurrency', async () => {
    const { Semaphore } = await import('../../src/shared/semaphore.ts');
    const sem = new Semaphore(1);
    let concurrent = 0;
    let maxConcurrent = 0;

    const task = async () => {
      const release = await sem.acquire();
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 5));
      concurrent--;
      release();
    };

    await Promise.all([task(), task(), task()]);
    expect(maxConcurrent).toBe(1);
  });
});

describe('TaskQueue', () => {
  it('should enqueue and complete a task', async () => {
    const { TaskQueue } = await import('../../src/shared/queue.ts');
    const queue = new TaskQueue();

    // Omit notebookId to avoid FK constraint in test DB.
    const taskId = queue.enqueue({ type: 'refine', priority: 0 });
    expect(taskId).toBeGreaterThan(0);

    queue.startWorker(async (_id, signal) => {
      await new Promise((r) => setTimeout(r, 1));
      if (signal.aborted) throw new Error('aborted');
      return { result: 'done' };
    });

    const result = await queue.waitForCompletion(taskId);
    expect(result).toEqual({ result: 'done' });
  });

  it('should cancel a pending task', async () => {
    const { TaskQueue } = await import('../../src/shared/queue.ts');
    const queue = new TaskQueue();

    // Omit notebookId to avoid FK constraint in test DB.
    const taskId = queue.enqueue({ type: 'refine', priority: 0 });

    // Simulate real usage: waitForCompletion is called first (creates promise),
    // then cancel is triggered externally.
    const waitPromise = queue.waitForCompletion(taskId);
    queue.cancel(taskId);

    try {
      await waitPromise;
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect((e as Error).message).toBe('Task cancelled');
    }
  });
});
