// c132 r485 — hidden derived source rows (outputs auto-indexing) must never
// appear on user-visible sources surfaces. Single choke point for the
// exclusion predicate + the derived-failure observability query; call sites
// MUST NOT hand-write the predicate.
import { and, eq, isNull, isNotNull, sql } from 'drizzle-orm';

import { client, db } from '../../db/index.ts';
import { sources } from '../../db/schema.ts';

/** Drizzle condition matching only user-visible (non-derived) sources. */
export function visibleSourcesOnly() {
  return isNull(sources.derivedOutputId);
}

/**
 * Count this notebook's derived container rows stuck in failed state (output
 * auto-indexing whose embed failed) — surfaced on the search-index status so
 * the UI can point at the rebuild entry (r485 observability).
 */
export async function countFailedDerived(notebookId: number): Promise<number> {
  const row = await client().get(
    db()
      .select({ c: sql<number>`COUNT(*)` })
      .from(sources)
      .where(
        and(
          eq(sources.notebookId, notebookId),
          isNotNull(sources.derivedOutputId),
          eq(sources.status, 'failed'),
        ),
      ),
  );
  return row?.c ?? 0;
}
