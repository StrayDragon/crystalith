import { z } from 'zod';

/**
 * Coerced path-id field for route `params` schemas — path segments arrive as
 * strings on the wire. Mounting these gives runtime validation (422 unified
 * envelope, see workspace-api-contract param-format-validation-envelope),
 * narrow Eden types (number), and removes per-handler manual parsing.
 */
export const PathId = z.coerce.number().int().positive();

/** Ready-made param object for the common notebook-scoped route shape. */
export const NidParamsSchema = z.object({ nid: PathId });
