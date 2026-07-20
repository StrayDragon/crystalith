// @crystalith/shared — common cross-cutting schemas
//
// Error envelopes, pagination, citations, and shared primitives.
// All API-facing timestamps are ISO 8601 UTC strings (the server serializes
// Drizzle integer timestamps to ISO on the boundary).
//
// OpenAPI: `zod-extend.ts` runs `extendZodWithOpenApi(z)` before schemas are
// built so `.openapi({ description, example })` works here. Server `openapi.ts`
// also extends (idempotent) and registers routes via `registerApiDoc`.
import './zod-extend.js';
import { z } from 'zod';

import { desc } from './i18n.js';

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
export const ErrorEnvelopeSchema = z
  .object({
    errorCode: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    retryAfter: z.number().int().nonnegative().optional(),
  })
  .openapi({
    description: '标准错误信封',
    example: { errorCode: 'NOT_FOUND', message: 'Resource not found' },
  });
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

/** Pagination query params (?offset=0&limit=20). */
export const PaginationParamsSchema = z
  .object({
    offset: z.coerce
      .number()
      .int()
      .nonnegative()
      .default(0)
      .openapi({
        description: desc('common.pagination_offset', '分页偏移量（从 0 开始）'),
        example: 0,
      }),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(200)
      .default(20)
      .openapi({
        description: desc('common.pagination_limit', '每页条数（最大 200）'),
        example: 20,
      }),
  })
  .openapi({ description: desc('common.pagination_params', '分页查询参数') });
export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

/** Generic paginated list wrapper `{ items, total, offset, limit }`. */
export function PaginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z
    .object({
      items: z.array(item).openapi({ description: desc('common.paginated_items', '当前页条目') }),
      total: z
        .number()
        .int()
        .nonnegative()
        .openapi({ description: desc('common.paginated_total', '符合条件的总条数') }),
      offset: z
        .number()
        .int()
        .nonnegative()
        .openapi({
          description: desc('common.pagination_offset', '分页偏移量（从 0 开始）'),
        }),
      limit: z
        .number()
        .int()
        .positive()
        .openapi({ description: desc('common.pagination_limit', '每页条数（最大 200）') }),
    })
    .openapi({ description: desc('common.paginated_envelope', '分页列表响应信封') });
}

/** Slice an in-memory list into a PaginatedSchema envelope. */
export function paginateItems<T>(
  items: T[],
  offset: number,
  limit: number,
): { items: T[]; total: number; offset: number; limit: number } {
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    offset,
    limit,
  };
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

/**
 * Required notebook scope for notebook-owned resource endpoints (c67).
 * Used as `?notebookId=` on flat `/v2/.../:id` routes (sources, outputs,
 * research, studio slides, tasks, citations). Missing → validation reject;
 * mismatch → 404 NOT_FOUND (no cross-notebook leak).
 *
 * Nested canonical routes (c69) use path `:nid` instead; see
 * `OptionalNotebookIdBodySchema` for optional body carry-over.
 */
export const NotebookIdQuerySchema = z
  .object({
    notebookId: z.coerce
      .number()
      .int()
      .positive()
      .openapi({ description: '笔记本 ID（归属范围，必填）', example: 1 }),
  })
  .openapi({ description: '笔记本归属查询参数' });
export type NotebookIdQuery = z.infer<typeof NotebookIdQuerySchema>;

/**
 * Optional body `notebookId` on nested `/v2/notebooks/:nid/...` routes (c69).
 * Path `:nid` is SSOT; if body carries notebookId it MUST equal `:nid` (else 400).
 */
export const OptionalNotebookIdBodySchema = z.object({
  notebookId: IdSchema.optional(),
});
export type OptionalNotebookIdBody = z.infer<typeof OptionalNotebookIdBodySchema>;

// ---------------------------------------------------------------------------
// Health / API root (server scaffold)
// ---------------------------------------------------------------------------

export const HealthResponseSchema = z.object({
  status: z.string(),
  version: z.string().optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ApiRootSchema = z.object({
  message: z.string(),
});
export type ApiRoot = z.infer<typeof ApiRootSchema>;

const HealthServiceProbeSchema = z.object({
  service: z.string(),
  healthy: z.boolean().nullable(),
  note: z.string().optional(),
});

const HealthOptionalProbeSchema = z.object({
  service: z.string(),
  enabled: z.boolean(),
  endpoint: z.string().nullable(),
  status: z.string(),
  healthy: z.boolean().nullable(),
});

export const HealthDependenciesSchema = z.object({
  status: z.string(),
  generatedAt: IsoTimestampSchema,
  lastProbe: IsoTimestampSchema,
  core: z.object({
    backend: HealthServiceProbeSchema,
    frontend: HealthServiceProbeSchema,
  }),
  optional: z.object({
    cacheRedis: HealthOptionalProbeSchema,
    searchSearxng: HealthOptionalProbeSchema,
  }),
});
export type HealthDependencies = z.infer<typeof HealthDependenciesSchema>;

/**
 * HTTP 204 No Content success body.
 * Elysia strips any returned value to `undefined` for status 204 before
 * response validation — mount as `response: { 204: Empty204Schema }`.
 */
export const Empty204Schema = z.undefined().openapi({
  description: desc('common.empty_204', '无响应体（HTTP 204）'),
});
export type Empty204 = z.infer<typeof Empty204Schema>;
