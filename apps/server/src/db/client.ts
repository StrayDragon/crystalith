// Async data-access port over the sync bun:sqlite ORM.
//
// Every runtime query goes through this port so the call sites are written
// against an async API today (`await client().all(...)`), keeping the
// bun-sqlite driver swappable for an async one (Bun.SQL / postgres.js) in a
// future backend change without touching call sites again. The sqlite
// implementation just wraps the sync drizzle results in resolved promises —
// semantics (ordering, WAL single-writer behavior) are identical to calling
// the builder terminals directly.
//
// Boot-time code (createDb migrations + initVecChunks DDL) stays synchronous
// on purpose: it runs before any caller can await. Runtime paths MUST NOT
// call builder terminals (`.all()/.get()/.run()`) or raw `orm.all/get/run`
// directly — route through a DbClient.
import type { SQLWrapper } from 'drizzle-orm';

import type { Orm } from './index.ts';

/** Async data-access port. See module header for the rationale. */
export interface DbClient {
  /** Evaluate a drizzle builder's `.all()` terminal asynchronously. */
  all<T>(q: SQLWrapper & { all(): T[] }): Promise<T[]>;
  /** Evaluate a drizzle builder's `.get()` terminal asynchronously. */
  get<T>(q: SQLWrapper & { get(): T | undefined }): Promise<T | undefined>;
  /** Evaluate a drizzle builder's `.run()` terminal asynchronously. */
  run<R>(q: SQLWrapper & { run(): R }): Promise<R>;
  /** Run a raw `sql` template, returning all rows (object-shaped). */
  raw<T = unknown>(stmt: SQLWrapper): Promise<T[]>;
  /** Run a raw `sql` template statement (DDL / DML without row results). */
  rawRun(stmt: SQLWrapper): Promise<unknown>;
}

/** Bind a DbClient to a specific ORM instance (tests / explicit lifecycles). */
export function createDbClient(orm: Orm): DbClient {
  return {
    all: (q) => Promise.resolve(q.all()),
    get: (q) => Promise.resolve(q.get()),
    run: (q) => Promise.resolve(q.run()),
    raw: <T>(stmt: SQLWrapper) => Promise.resolve(orm.all<T>(stmt)),
    rawRun: (stmt: SQLWrapper) => Promise.resolve(orm.run(stmt)),
  };
}
