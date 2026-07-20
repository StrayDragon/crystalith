// Nested notebook path ownership helpers (c69).
//
// Canonical routes use `/v2/notebooks/:nid/...` where `:nid` is the ownership
// SSOT. Flat aliases keep c67 query/body `notebookId` requirements.
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
