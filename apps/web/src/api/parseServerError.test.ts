import { describe, expect, it } from 'vitest';

import { parseServerError } from './parseServerError';

describe('parseServerError', () => {
  it('parses the Eden treaty nested shape { status, value: ErrorEnvelope }', () => {
    const edenError = {
      status: 400,
      value: {
        errorCode: 'INVALID_REQUEST',
        message: 'Unsupported output type: PARAGRAPH',
      },
    };
    expect(parseServerError(edenError)).toEqual({
      errorCode: 'INVALID_REQUEST',
      message: 'Unsupported output type: PARAGRAPH',
      status: 400,
    });
  });

  it('reads the ErrorEnvelope from .value including details', () => {
    const edenError = {
      status: 409,
      value: {
        errorCode: 'CONNECTOR_UNAVAILABLE',
        message: 'Source connector "x" is not available',
        details: { hint: 'Install or enable the "x" connector plugin' },
      },
    };
    const parsed = parseServerError(edenError);
    expect(parsed.message).toContain('not available');
    expect(parsed.details).toEqual({ hint: 'Install or enable the "x" connector plugin' });
    expect(parsed.errorCode).toBe('CONNECTOR_UNAVAILABLE');
  });

  it('still handles top-level envelope shapes (legacy fallback)', () => {
    expect(parseServerError({ errorCode: 'NOT_FOUND', message: 'Notebook 999 not found' })).toEqual(
      { errorCode: 'NOT_FOUND', message: 'Notebook 999 not found' },
    );
  });

  it('never returns an [object Object] message for object inputs', () => {
    // Regression guard (Chrome-MCP session): the Eden nested shape used to
    // fall through to a stringified-object message.
    const parsed = parseServerError({
      status: 400,
      value: { errorCode: 'INVALID_REQUEST', message: 'Unsupported output type: PARAGRAPH' },
    });
    expect(parsed.message).not.toContain('[object Object]');
    expect(parsed.message.length).toBeGreaterThan(0);
  });

  it('handles primitives and unknown shapes', () => {
    expect(parseServerError('plain string').message).toBe('plain string');
    expect(parseServerError(42).message).toBe('42');
    expect(parseServerError({}).message).toBe('Unknown error');
    expect(parseServerError(undefined).message).toBe('Unknown error');
  });
});
