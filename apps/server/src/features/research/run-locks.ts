/**
 * Per-ResearchRun mutual exclusion (c106).
 * - LLM lock: at most one in-flight model call per runId
 * - Write lock: serialize persistGraph / evidence / writeBack critical sections
 * Different runs never share these locks.
 */

type AsyncFn<T> = () => T | Promise<T>;

const llmTails = new Map<number, Promise<unknown>>();
const writeTails = new Map<number, Promise<unknown>>();

function withRunQueue<T>(
  tails: Map<number, Promise<unknown>>,
  runId: number,
  fn: AsyncFn<T>,
): Promise<T> {
  const prev = tails.get(runId) ?? Promise.resolve();
  const run = prev.then(
    () => fn(),
    () => fn(),
  );
  // Keep the chain alive for waiters; swallow so one failure does not poison the queue.
  tails.set(
    runId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

/** Serialize LLM work for one ResearchRun (different runs may overlap). */
export function withRunLlmLock<T>(runId: number, fn: AsyncFn<T>): Promise<T> {
  return withRunQueue(llmTails, runId, fn);
}

/** Serialize graph/evidence write-backs for one ResearchRun. */
export function withRunWriteLock<T>(runId: number, fn: AsyncFn<T>): Promise<T> {
  return withRunQueue(writeTails, runId, fn);
}

/** Test / teardown helper — drop idle queue tails. */
export function clearRunLocks(runId?: number): void {
  if (runId === undefined) {
    llmTails.clear();
    writeTails.clear();
    return;
  }
  llmTails.delete(runId);
  writeTails.delete(runId);
}
