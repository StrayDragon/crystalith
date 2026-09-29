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
 * Eden treaty nests the response body under `value`
 * ({ status, value: ErrorEnvelope }), so `error.value` is read first when
 * present; top-level fields are the fallback for legacy/alternate shapes.
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
  // Eden treaty: the ErrorEnvelope lives on `.value`, not on the error itself.
  const source = isRecord(error.value) ? { ...error, ...error.value } : error;
  const errorCode =
    typeof source.errorCode === 'string'
      ? source.errorCode
      : typeof source.code === 'string'
        ? source.code
        : undefined;
  const message =
    typeof source.message === 'string'
      ? source.message
      : typeof source.detail === 'string'
        ? source.detail
        : 'Unknown error';
  const details = isRecord(source.details) ? source.details : undefined;
  const status =
    typeof error.status === 'number'
      ? error.status
      : typeof source.status === 'number'
        ? source.status
        : undefined;
  return { errorCode, message, details, status };
}

/** Max characters of server error copy inlined into a transport message. */
const SERVER_ERROR_DETAIL_CAP = 72;

/**
 * Envelope → short single-line display copy for transport error messages
 * (stream.ts non-2xx path). Schema-validation dumps are collapsed to the
 * first offending property; free-form messages are whitespace-collapsed and
 * capped so `mapTransportError`'s short-message passthrough still shows them.
 * Returns '' when there is nothing worth surfacing.
 */
export function summarizeErrorEnvelope(envelope: unknown): string {
  const { errorCode, message, details } = parseServerError(envelope);
  if (errorCode === 'SCHEMA_VALIDATION_FAILED') {
    const property = typeof details?.property === 'string' ? details.property : undefined;
    return property ? `参数校验失败（${property}）` : '参数校验失败';
  }
  if (!message || message === 'Unknown error') return '';
  return message.replaceAll(/\s+/gu, ' ').trim().slice(0, SERVER_ERROR_DETAIL_CAP);
}
