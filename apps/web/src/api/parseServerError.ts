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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Parse an eden treaty error (or any thrown value) into a stable shape.
 *
 * Reads `errorCode` (the ErrorEnvelope SSOT field) first, then falls back to
 * `code` for robustness. Exposes the code as `errorCode`.
 */
export function parseServerError(error: unknown): ParsedServerError {
  if (!isRecord(error)) {
    if (typeof error === 'string') return { message: error };
    if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
      return { message: String(error) };
    }
    return { message: 'Unknown error' };
  }
  const errorCode =
    typeof error.errorCode === 'string'
      ? error.errorCode
      : typeof error.code === 'string'
        ? error.code
        : undefined;
  const message =
    typeof error.message === 'string'
      ? error.message
      : typeof error.detail === 'string'
        ? error.detail
        : 'Unknown error';
  const details = isRecord(error.details) ? error.details : undefined;
  const status = typeof error.status === 'number' ? error.status : undefined;
  return { errorCode, message, details, status };
}
