// Eval harness schemas — Golden Dataset + LLM-as-Judge + A/B run comparison.
// Schema for the eval tables is defined here so the data layer can provision
// them in the Drizzle schema upfront (SSOT).
import { z } from 'zod';

import { IdSchema, IsoTimestampSchema, JsonMetadataSchema } from './common.js';

// ---------------------------------------------------------------------------
// Datasets + items (Golden Dataset)
// ---------------------------------------------------------------------------

export const EvalItemSchema = z.object({
  id: IdSchema,
  datasetId: IdSchema,
  question: z.string().min(1),
  expectedAnswer: z.string().min(1),
  expectedSources: z.array(IdSchema).nullable().optional(),
  notebookId: IdSchema,
  createdAt: IsoTimestampSchema,
});
export type EvalItem = z.infer<typeof EvalItemSchema>;

export const EvalDatasetSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  notebookId: IdSchema.nullable().optional(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type EvalDataset = z.infer<typeof EvalDatasetSchema>;

export const EvalDatasetCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  notebookId: IdSchema.nullable().optional(),
});
export type EvalDatasetCreate = z.infer<typeof EvalDatasetCreateSchema>;

export const EvalItemCreateSchema = z.object({
  question: z.string().min(1),
  expectedAnswer: z.string().min(1),
  expectedSources: z.array(IdSchema).nullable().optional(),
  notebookId: IdSchema,
});
export type EvalItemCreate = z.infer<typeof EvalItemCreateSchema>;

// ---------------------------------------------------------------------------
// Runs + run items
// ---------------------------------------------------------------------------

export const EvalRunStatusSchema = z.enum(['running', 'completed', 'failed', 'cancelled']);
export type EvalRunStatus = z.infer<typeof EvalRunStatusSchema>;

export const EvalRunSchema = z.object({
  id: IdSchema,
  datasetId: IdSchema,
  strategyIds: z.array(z.string()),
  status: EvalRunStatusSchema,
  startedAt: IsoTimestampSchema,
  finishedAt: IsoTimestampSchema.nullable().optional(),
  summary: JsonMetadataSchema.nullable().optional(),
});
export type EvalRun = z.infer<typeof EvalRunSchema>;

export const EvalMetricsSchema = z.object({
  faithfulness: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  recall: z.number().min(0).max(1).nullable().optional(),
  precision: z.number().min(0).max(1).nullable().optional(),
  latencyMs: z.number().int().nonnegative(),
  explanation: z.string().nullable().optional(),
});
export type EvalMetrics = z.infer<typeof EvalMetricsSchema>;

export const EvalRunItemSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  itemId: IdSchema,
  strategyId: z.string(),
  question: z.string(),
  answer: z.string(),
  retrievedSourceIds: z.array(IdSchema).default([]),
  metrics: EvalMetricsSchema,
  createdAt: IsoTimestampSchema,
});
export type EvalRunItem = z.infer<typeof EvalRunItemSchema>;

// ---------------------------------------------------------------------------
// Runner request (CLI / endpoint)
// ---------------------------------------------------------------------------

export const EvalRunRequestSchema = z.object({
  datasetId: IdSchema,
  strategyIds: z.array(z.string()).min(1),
});
export type EvalRunRequest = z.infer<typeof EvalRunRequestSchema>;

/** POST /v2/eval/datasets and /v2/eval/datasets/import */
export const EvalDatasetUpsertRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  items: z.array(EvalItemCreateSchema).default([]),
});
export type EvalDatasetUpsertRequest = z.infer<typeof EvalDatasetUpsertRequestSchema>;

export const EvalDatasetCreatedResponseSchema = z.object({
  id: IdSchema,
  name: z.string(),
});
export type EvalDatasetCreatedResponse = z.infer<typeof EvalDatasetCreatedResponseSchema>;

export const EvalDatasetSummarySchema = z.object({
  id: IdSchema,
  name: z.string(),
  description: z.string().nullable().optional(),
  notebookId: IdSchema.nullable().optional(),
  itemCount: z.number().int().nonnegative(),
  createdAt: IsoTimestampSchema,
});
export type EvalDatasetSummary = z.infer<typeof EvalDatasetSummarySchema>;

/** GET /v2/eval/datasets/:id — items omit datasetId/createdAt vs EvalItemSchema. */
export const EvalDatasetDetailItemSchema = z.object({
  id: IdSchema,
  question: z.string(),
  expectedAnswer: z.string(),
  expectedSources: z.array(IdSchema).nullable().optional(),
  notebookId: IdSchema,
});
export const EvalDatasetDetailSchema = z.object({
  id: IdSchema,
  name: z.string(),
  description: z.string().nullable().optional(),
  notebookId: IdSchema.nullable().optional(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
  items: z.array(EvalDatasetDetailItemSchema),
});
export type EvalDatasetDetail = z.infer<typeof EvalDatasetDetailSchema>;

/** GET /v2/eval/datasets/:id/export — portable JSON without row ids. */
export const EvalDatasetExportSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  items: z.array(
    z.object({
      question: z.string(),
      expectedAnswer: z.string(),
      expectedSources: z.array(IdSchema).nullable().optional(),
      notebookId: IdSchema,
    }),
  ),
});
export type EvalDatasetExport = z.infer<typeof EvalDatasetExportSchema>;

/** Immediate result from POST /v2/eval/runs (in-process runner). */
export const EvalRunResultSchema = z.object({
  runId: IdSchema,
  datasetId: IdSchema,
  strategyIds: z.array(z.string()),
  status: z.string(),
  items: z.array(
    z.object({
      itemId: IdSchema,
      strategyId: z.string(),
      question: z.string(),
      answer: z.string(),
      faithfulness: z.number(),
      relevance: z.number(),
      recall: z.number().optional(),
      precision: z.number().optional(),
      latencyMs: z.number().int().nonnegative(),
    }),
  ),
  summary: z.object({
    avgFaithfulness: z.number(),
    avgRelevance: z.number(),
    avgRecall: z.number(),
    avgLatencyMs: z.number(),
    totalItems: z.number().int().nonnegative(),
  }),
});
export type EvalRunResult = z.infer<typeof EvalRunResultSchema>;
