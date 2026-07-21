// Shared error-response helper — c54.
//
// All non-SSE error responses MUST go through `sendError` so the body matches
// the ErrorEnvelopeSchema from @crystalith/shared (errorCode + message +
// optional details + optional retryAfter). This replaces the ad-hoc
// `{ error: string }` / `{ error, errorCode }` shapes that were inlined across
// feature routers.
//
// Usage in an Elysia handler:
//   return sendError(set, 'INVALID_REQUEST', 'sourceIds must not be empty');
//   return sendError(set, 'CONFLICT', 'Tag name already exists', { existingTagId });
//   return sendError(set, 'RATE_LIMITED', 'Too many requests', undefined, 30);
//
// Prefer `throw new AppHttpError(...)` when the handler's success return type
// must stay narrow for Eden (returning sendError widens the treaty union).
import type { ErrorEnvelope } from '@crystalith/shared';

/** Semantic error codes mapped to canonical HTTP statuses. */
export const ErrorCode = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  MODEL_ERROR: 'MODEL_ERROR',
  CONNECTOR_UNAVAILABLE: 'CONNECTOR_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Canonical HTTP status for each error code. */
const STATUS_BY_CODE = {
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCode.SCHEMA_VALIDATION_FAILED]: 422,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.MODEL_UNAVAILABLE]: 503,
  [ErrorCode.MODEL_ERROR]: 503,
  [ErrorCode.CONNECTOR_UNAVAILABLE]: 409,
  [ErrorCode.INTERNAL_ERROR]: 500,
} as const satisfies Record<ErrorCode, number>;

/** Elysia `set` object (only the status field is touched). */
interface SetStatus {
  status?: number | string;
}

/**
 * Throw from handlers when the success body type must stay narrow for Eden.
 * Mapped to ErrorEnvelope by the global `onError` hook in `server.ts`.
 */
export class AppHttpError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'AppHttpError';
  }
}

/**
 * Build an ErrorEnvelope, set the HTTP status on `set`, and return the body.
 * Pass an explicit `status` to override the code's canonical status (rare).
 * Semantic extra fields (existing_tag_id, max_bytes, …) go in `details`.
 */
export function sendError(
  set: SetStatus,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  retryAfter?: number,
): ErrorEnvelope {
  set.status = STATUS_BY_CODE[code];
  const body: ErrorEnvelope = { errorCode: code, message };
  if (details !== undefined) body.details = details;
  if (retryAfter !== undefined) body.retryAfter = retryAfter;
  return body;
}
