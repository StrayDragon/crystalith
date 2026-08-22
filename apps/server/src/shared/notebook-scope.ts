// Nested notebook path ownership helpers (c69).
//
// Canonical routes use `/v2/notebooks/:nid/...` where `:nid` is the ownership
// SSOT. Flat aliases keep c67 query/body `notebookId` requirements.
import { eq } from 'drizzle-orm';
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import { db } from '../db/index.ts';
import { AppHttpError, ErrorCode } from './errors.ts';

/**
 * Resolve notebook id for a nested route.
 * - Path `:nid` always wins.
 * - If `bodyOrQueryNotebookId` is present and differs → 400 INVALID_REQUEST.
 */
export function resolveNestedNotebookId(
  pathNid: number,
  bodyOrQueryNotebookId?: number | null,
): number {
  if (
    bodyOrQueryNotebookId !== undefined &&
    bodyOrQueryNotebookId !== null &&
    bodyOrQueryNotebookId !== pathNid
  ) {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      `notebookId ${bodyOrQueryNotebookId} does not match path notebook ${pathNid}`,
      { pathNotebookId: pathNid, bodyNotebookId: bodyOrQueryNotebookId },
    );
  }
  return pathNid;
}

/**
 * Fetch a row by id and assert it lives under notebook `nid`; 404 otherwise.
 *
 * Collapses the per-feature ownership boilerplate
 * (`select → !row || row.notebookId !== nid → throw`) that was duplicated
 * across sessions/messages/sources/studio/outputs/source-connectors routers.
 *
 * `label` names the entity for the error message, e.g. `'Session'` →
 * `"Session 3 not found"` (same wire shape as the previous NotFoundError throws).
 */
export function requireOwnedRow<
  TTable extends SQLiteTable & { id: AnySQLiteColumn; notebookId: AnySQLiteColumn },
>(table: TTable, id: number, nid: number, label: string) {
  const row = db().select().from(table).where(eq(table.id, id)).get();
  if (!row || row.notebookId !== nid) {
    throw new AppHttpError(ErrorCode.NOT_FOUND, `${label} ${id} not found`);
  }
  return row;
}
