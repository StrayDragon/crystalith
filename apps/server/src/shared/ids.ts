import { z } from 'zod';

/**
 * Parse a query/body identifier as a positive integer where loose semantics
 * are wanted (INVALID_REQUEST with custom label). Path params SHOULD prefer
 * the `PathId` coerced schema instead — see workspace-api-contract
 * param-format-validation-envelope.
 */
import { AppHttpError, ErrorCode } from './errors.ts';

/**
 * Coerced path-id field for route `params` schemas — path segments arrive as
 * strings on the wire. Mounting these gives runtime validation (422 unified
 * envelope, see workspace-api-contract param-format-validation-envelope),
 * narrow Eden types (number), and removes per-handler manual parsing.
 */
export const PathId = z.coerce.number().int().positive();

/** Ready-made param objects for the common single-id route shapes. */
export const NidParamsSchema = z.object({ nid: PathId });
export const IdParamsSchema = z.object({ id: PathId });
export const SidParamsSchema = z.object({ sid: PathId });
export const TidParamsSchema = z.object({ tid: PathId });
export const RidParamsSchema = z.object({ rid: PathId });
export const BindingIdParamsSchema = z.object({ bindingId: PathId });

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
