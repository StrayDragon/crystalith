/**
 * Parse a path/query identifier as a positive integer.
 * Rejects NaN, floats, zero, negatives, and non-numeric strings so callers
 * can return INVALID_REQUEST instead of `"… NaN not found"`.
 */
import { AppHttpError, ErrorCode } from './errors.ts';

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

/**
 * Require a positive integer id or throw AppHttpError (INVALID_REQUEST).
 * Prefer this in Elysia handlers so Eden success types stay narrow.
 */
export function requirePositiveIntId(raw: unknown, label: string): number {
  const id = parsePositiveIntId(raw);
  if (id === null) {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, `Invalid ${label}: ${String(raw)}`);
  }
  return id;
}

/**
 * Like requirePositiveIntId, but treats undefined / null / '' as absent.
 */
export function requireOptionalPositiveIntId(raw: unknown, label: string): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  return requirePositiveIntId(raw, label);
}
