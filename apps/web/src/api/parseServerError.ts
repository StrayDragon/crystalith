// Shared eden treaty error parser — c63.
//
// eden treaty surfaces server errors as the raw response body, which for v2
// non-SSE routes is the ErrorEnvelope from @crystalith/shared
// ({ errorCode, message, details?, retryAfter? }). This helper normalizes
// that envelope (plus a couple of legacy/alternate shapes) into a stable
// camelCase form so call sites stop hand-rolling inline
// `{ errorCode?, details?, message? }` casts that drift from the SSOT.

export interface ParsedServerError {
  errorCode?: string;
  message: string;
  details?: Record<string, unknown>;
  status?: number;
}

/**
 * Parse an eden treaty error (or any thrown value) into a stable shape.
 *
 * Reads `errorCode` (the ErrorEnvelope SSOT field) first, then falls back to
 * `code` for robustness. Exposes the code as `errorCode`.
 */
export function parseServerError(error: unknown): ParsedServerError {
  if (!error || typeof error !== 'object') {
    return { message: String(error) };
  }
  const e = error as Record<string, unknown>;
  const errorCode =
    typeof e.errorCode === 'string'
      ? e.errorCode
      : typeof e.code === 'string'
        ? e.code
        : typeof e.errorCode === 'string'
          ? e.errorCode
          : undefined;
  const message =
    typeof e.message === 'string'
      ? e.message
      : typeof e.detail === 'string'
        ? e.detail
        : 'Unknown error';
  const details =
    typeof e.details === 'object' && e.details !== null
      ? (e.details as Record<string, unknown>)
      : undefined;
  const status = typeof e.status === 'number' ? e.status : undefined;
  return { errorCode, message, details, status };
}
