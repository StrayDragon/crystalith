import { describe, expect, it } from 'bun:test';

import { parsePositiveIntId } from '../../src/shared/ids.ts';

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
