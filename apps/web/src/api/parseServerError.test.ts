import { describe, expect, it } from '@rstest/core';

import { parseServerError, summarizeErrorEnvelope } from './parseServerError';

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

describe('summarizeErrorEnvelope', () => {
  it('returns the envelope message for free-form errors', () => {
    expect(
      summarizeErrorEnvelope({
        errorCode: 'INVALID_REQUEST',
        message: 'Missing query after /prompt directive',
      }),
    ).toBe('Missing query after /prompt directive');
  });

  it('collapses schema-validation dumps to the offending property', () => {
    expect(
      summarizeErrorEnvelope({
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: '{\n  "type": "validation",\n  "on": "body"}',
        details: { property: 'generationTypeId' },
      }),
    ).toBe('参数校验失败（generationTypeId）');
  });

  it('falls back to a generic label when details lack a property', () => {
    expect(summarizeErrorEnvelope({ errorCode: 'SCHEMA_VALIDATION_FAILED', message: 'dump' })).toBe(
      '参数校验失败',
    );
  });

  it('collapses whitespace and caps long messages', () => {
    const long = `word ${'x'.repeat(200)}`;
    const summarized = summarizeErrorEnvelope({ message: `multi\nline\twhitespace ${long}` });
    expect(summarized).not.toMatch(/\s{2,}/u);
    expect(summarized.length).toBeLessThanOrEqual(72);
  });

  it('returns empty for unknown shapes', () => {
    expect(summarizeErrorEnvelope({})).toBe('');
    expect(summarizeErrorEnvelope(undefined)).toBe('');
  });
});
