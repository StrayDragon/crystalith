// Tests for the research session lock's TTL logic (pure, no DB).
import { describe, expect, it } from 'bun:test';

import { isLockHeld } from '../../src/features/research/router.ts';

describe('isLockHeld', () => {
  it('returns false when lockExpiresAt is null (never locked)', () => {
    expect(isLockHeld({ lockExpiresAt: null })).toBe(false);
  });

  it('returns true when lockExpiresAt is in the future', () => {
    const now = new Date('2026-07-09T12:00:00Z');
    const future = new Date('2026-07-09T12:05:00Z');
    expect(isLockHeld({ lockExpiresAt: future }, now)).toBe(true);
  });

  it('returns false when lockExpiresAt is in the past (expired)', () => {
    const now = new Date('2026-07-09T12:00:00Z');
    const past = new Date('2026-07-09T11:50:00Z');
    expect(isLockHeld({ lockExpiresAt: past }, now)).toBe(false);
  });

  it('returns false when lockExpiresAt equals now (boundary, treat as released)', () => {
    const now = new Date('2026-07-09T12:00:00Z');
    expect(isLockHeld({ lockExpiresAt: now }, now)).toBe(false);
  });
});
