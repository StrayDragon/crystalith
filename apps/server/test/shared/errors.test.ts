// Unit tests for the shared error helper (c54).
//
// sendError MUST produce an ErrorEnvelope (error_code + message + optional
// details/retry_after) and set the canonical HTTP status for each code.
import { describe, expect, it } from 'bun:test';

import { ErrorCode, sendError } from '../../src/shared/errors.ts';

describe('sendError', () => {
  it('sets the canonical status and returns error_code + message', () => {
    const set: { status?: number | string } = {};
    const body = sendError(set, ErrorCode.INVALID_REQUEST, 'source_ids must not be empty');
    expect(set.status).toBe(400);
    expect(body).toEqual({
      error_code: 'INVALID_REQUEST',
      message: 'source_ids must not be empty',
    });
  });

  it('maps each ErrorCode to its canonical HTTP status', () => {
    const cases: Array<[ErrorCode, number]> = [
      [ErrorCode.INVALID_REQUEST, 400],
      [ErrorCode.NOT_FOUND, 404],
      [ErrorCode.FORBIDDEN, 403],
      [ErrorCode.CONFLICT, 409],
      [ErrorCode.PAYLOAD_TOO_LARGE, 413],
      [ErrorCode.SCHEMA_VALIDATION_FAILED, 422],
      [ErrorCode.RATE_LIMITED, 429],
      [ErrorCode.MODEL_UNAVAILABLE, 503],
      [ErrorCode.MODEL_ERROR, 503],
      [ErrorCode.CONNECTOR_UNAVAILABLE, 409],
      [ErrorCode.INTERNAL_ERROR, 500],
    ];
    for (const [code, status] of cases) {
      const set: { status?: number | string } = {};
      sendError(set, code, 'msg');
      expect(set.status).toBe(status);
    }
  });

  it('includes details when provided (semantic extra fields)', () => {
    const set: { status?: number | string } = {};
    const body = sendError(set, ErrorCode.CONFLICT, 'Tag name already exists', {
      existing_tag_id: 7,
    });
    expect(set.status).toBe(409);
    expect(body.details).toEqual({ existing_tag_id: 7 });
  });

  it('includes retry_after when provided', () => {
    const set: { status?: number | string } = {};
    const body = sendError(set, ErrorCode.RATE_LIMITED, 'Too many requests', undefined, 30);
    expect(set.status).toBe(429);
    expect(body.retry_after).toBe(30);
  });

  it('omits details and retry_after when not provided', () => {
    const body = sendError({}, ErrorCode.NOT_FOUND, 'missing');
    expect(body).not.toHaveProperty('details');
    expect(body).not.toHaveProperty('retry_after');
  });
});
