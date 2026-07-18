import { describe, expect, it } from 'bun:test';

import { AppHttpError, ErrorCode } from '../../src/shared/errors.ts';
import {
  parsePositiveIntId,
  requireOptionalPositiveIntId,
  requirePositiveIntId,
} from '../../src/shared/ids.ts';

describe('parsePositiveIntId', () => {
  it('accepts positive integer strings and numbers', () => {
    expect(parsePositiveIntId('1')).toBe(1);
    expect(parsePositiveIntId('42')).toBe(42);
    expect(parsePositiveIntId(7)).toBe(7);
  });

  it('rejects non-numeric, float, zero, and negative values', () => {
    expect(parsePositiveIntId('nonexistent-nb')).toBeNull();
    expect(parsePositiveIntId('12.5')).toBeNull();
    expect(parsePositiveIntId('0')).toBeNull();
    expect(parsePositiveIntId('-1')).toBeNull();
    expect(parsePositiveIntId(NaN)).toBeNull();
    expect(parsePositiveIntId(undefined)).toBeNull();
    expect(parsePositiveIntId('')).toBeNull();
  });
});

describe('requirePositiveIntId', () => {
  it('returns parsed id for valid input', () => {
    expect(requirePositiveIntId('7', 'notebook id')).toBe(7);
  });

  it('throws AppHttpError INVALID_REQUEST for invalid input', () => {
    expect(() => requirePositiveIntId('abc', 'notebook id')).toThrow(AppHttpError);
    try {
      requirePositiveIntId('abc', 'notebook id');
    } catch (error) {
      expect(error).toBeInstanceOf(AppHttpError);
      expect((error as AppHttpError).code).toBe(ErrorCode.INVALID_REQUEST);
      expect((error as AppHttpError).message).toBe('Invalid notebook id: abc');
    }
  });
});

describe('requireOptionalPositiveIntId', () => {
  it('returns undefined for absent values', () => {
    expect(requireOptionalPositiveIntId(undefined, 'session id')).toBeUndefined();
    expect(requireOptionalPositiveIntId(null, 'session id')).toBeUndefined();
    expect(requireOptionalPositiveIntId('', 'session id')).toBeUndefined();
  });

  it('returns parsed id when present', () => {
    expect(requireOptionalPositiveIntId('3', 'message id')).toBe(3);
  });

  it('throws AppHttpError INVALID_REQUEST for invalid present values', () => {
    expect(() => requireOptionalPositiveIntId('bad', 'message id')).toThrow(AppHttpError);
  });
});
