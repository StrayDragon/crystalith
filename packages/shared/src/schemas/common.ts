// @crystalith/shared — common cross-cutting schemas
//
// Error envelopes, pagination, citations, and shared primitives.
// All API-facing timestamps are ISO 8601 UTC strings (the server serializes
// Drizzle integer timestamps to ISO on the boundary).
//
// NOTE: .openapi() metadata is NOT available on shared schemas because
// @asteasolutions/zod-to-openapi's extendZodWithOpenApi only patches Zod
// instances created AFTER the call, and shared schemas are defined before
// the server's openapi.ts is loaded. Examples are injected at the OpenAPI
// registration level (openapi.ts → registerApiDoc).
import { z } from 'zod';

/** ISO 8601 UTC datetime string, e.g. `2026-07-08T12:00:00.000Z`. */
export const IsoTimestampSchema = z.string().datetime({ offset: true }).or(z.string().min(1));

/** Positive integer identifier. */
export const IdSchema = z.number().int().positive();

/** Common audit columns present on most entities. */
export const TimestampsSchema = z.object({
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});

/** Standard error envelope returned by all v2 endpoints on failure. */
export const ErrorEnvelopeSchema = z.object({
  errorCode: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  retryAfter: z.number().int().nonnegative().optional(),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

/** Pagination query params (?offset=0&limit=20). */
export const PaginationParamsSchema = z.object({
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(200).default(20),
});
export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

/** Generic paginated list wrapper. */
export function PaginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
  });
}

/**
 * Citation — wire/API grounded reference to a retrieved source chunk.
 * JSON field names are camelCase (SSOT for OpenAPI/eden and UI domain).
 */
export const CitationSchema = z.object({
  sourceId: z.number().int(),
  sourceName: z.string(),
  chunkId: z.number().int(),
  chunkIndex: z.number().int(),
  pageNumber: z.number().int().nullable().optional(),
  paragraphIndex: z.number().int().nullable().optional(),
  snippet: z.string(),
  score: z.number().nullable().optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

/** Loose JSON object metadata column shape. */
export const JsonMetadataSchema = z.record(z.string(), z.unknown());
export type JsonMetadata = z.infer<typeof JsonMetadataSchema>;

/** Helper: a nullable-optional ISO timestamp (e.g. last_error_at). */
export const OptionalTimestampSchema = IsoTimestampSchema.nullable().optional();
