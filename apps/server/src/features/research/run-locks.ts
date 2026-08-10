/**
 * Per-ResearchRun mutual exclusion (c106).
 * - LLM lock: at most one in-flight **model** step per runId; tool IO MAY
 *   release via `withRunLlmLockReleased` so parallel work-units overlap search.
 * - Write lock: serialize persistGraph / evidence / writeBack critical sections
 * Different runs never share these locks.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

type AsyncFn<T> = () => T | Promise<T>;

type MutexState = {
  locked: boolean;
  waiters: Array<() => void>;
};

const llmMutex = new Map<number, MutexState>();
const writeTails = new Map<number, Promise<unknown>>();

const llmAls = new AsyncLocalStorage<{ runId: number; released: boolean }>();

function getMutex(map: Map<number, MutexState>, runId: number): MutexState {
  let state = map.get(runId);
  if (!state) {
    state = { locked: false, waiters: [] };
    map.set(runId, state);
  }
  return state;
}

export async function acquireRunLlmLock(runId: number): Promise<void> {
  const state = getMutex(llmMutex, runId);
  if (!state.locked) {
    state.locked = true;
    return;
  }
  await new Promise<void>((resolve) => {
    state.waiters.push(resolve);
  });
}

export function releaseRunLlmLock(runId: number): void {
  const state = llmMutex.get(runId);
  if (!state) return;
  const next = state.waiters.shift();
  if (next) {
    // Transfer hold to the next waiter (stay locked).
    next();
  } else {
    state.locked = false;
  }
}

/** Serialize LLM model steps for one ResearchRun (different runs may overlap). */
export async function withRunLlmLock<T>(runId: number, fn: AsyncFn<T>): Promise<T> {
  await acquireRunLlmLock(runId);
  try {
    return await llmAls.run({ runId, released: false }, fn);
  } finally {
    releaseRunLlmLock(runId);
  }
}

/**
 * Temporarily release the current Run's LLM lock (e.g. during tool IO).
 * No-op when not inside `withRunLlmLock` or already released. Re-acquires before returning.
 */
export async function withRunLlmLockReleased<T>(fn: AsyncFn<T>): Promise<T> {
  const ctx = llmAls.getStore();
  if (!ctx || ctx.released) return fn();
  ctx.released = true;
  releaseRunLlmLock(ctx.runId);
  try {
    return await fn();
  } finally {
    await acquireRunLlmLock(ctx.runId);
    ctx.released = false;
  }
}

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
  tails.set(
    runId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

/** Serialize graph/evidence write-backs for one ResearchRun. */
export function withRunWriteLock<T>(runId: number, fn: AsyncFn<T>): Promise<T> {
  return withRunQueue(writeTails, runId, fn);
}

/** Test / teardown helper — drop idle queue tails. */
export function clearRunLocks(runId?: number): void {
  if (runId === undefined) {
    llmMutex.clear();
    writeTails.clear();
    return;
  }
  llmMutex.delete(runId);
  writeTails.delete(runId);
}
