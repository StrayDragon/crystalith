// Research session lock primitives — extracted from router.ts to break
// the circular dependency between agent.ts ↔ router.ts (H4 fix).
//
// Lock TTL is 10 minutes; renewLock extends it for long-running iterations.
// cleanupExpiredLocks cancels active sessions whose locks expired while
// the process was down.
import { eq } from 'drizzle-orm';
import { NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { researchSessions } from '../../db/schema.ts';

const LOCK_TTL_MS = 10 * 60 * 1000;

export function isLockHeld(
  row: { lockExpiresAt: Date | null },
  now: Date = new Date(),
): boolean {
  return row.lockExpiresAt !== null && row.lockExpiresAt > now;
}

export function acquireLock(id: number): void {
  const now = new Date();
  const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
  if (!row) throw new NotFoundError(`Research session ${id} not found`);
  if (isLockHeld(row, now)) {
    throw new Error(`Research session ${id} is locked by another run`);
  }
  db()
    .update(researchSessions)
    .set({ lockedAt: now, lockExpiresAt: new Date(now.getTime() + LOCK_TTL_MS) })
    .where(eq(researchSessions.id, id))
    .run();
}

export function releaseLock(id: number): void {
  db()
    .update(researchSessions)
    .set({ lockedAt: null, lockExpiresAt: null })
    .where(eq(researchSessions.id, id))
    .run();
}

/** Renew lock during long runs (v1 _extend_lock_periodically, api.py:885). */
export function renewLock(id: number): void {
  const now = new Date();
  db()
    .update(researchSessions)
    .set({ lockExpiresAt: new Date(now.getTime() + LOCK_TTL_MS) })
    .where(eq(researchSessions.id, id))
    .run();
}

/** Clean up expired locks (v1 check_and_cleanup_expired_locks, c37). */
export function cleanupExpiredLocks(): number {
  const now = new Date();
  const expired = db()
    .select()
    .from(researchSessions)
    .all()
    .filter((row) => row.lockExpiresAt !== null && row.lockExpiresAt < now);

  for (const row of expired) {
    if (
      row.status === 'planning' ||
      row.status === 'searching' ||
      row.status === 'analyzing' ||
      row.status === 'waiting_user'
    ) {
      db()
        .update(researchSessions)
        .set({
          status: 'cancelled',
          lockedAt: null,
          lockExpiresAt: null,
        })
        .where(eq(researchSessions.id, row.id))
        .run();
    } else {
      releaseLock(row.id);
    }
  }
  return expired.length;
}
