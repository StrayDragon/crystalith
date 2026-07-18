/**
 * Parse a path/query identifier as a positive integer.
 * Rejects NaN, floats, zero, negatives, and non-numeric strings so callers
 * can return INVALID_REQUEST instead of `"… NaN not found"`.
 */
export function parsePositiveIntId(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw === 'string' && /^\d+$/u.test(raw)) {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
}
