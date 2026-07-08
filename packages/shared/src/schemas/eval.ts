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
  dataset_id: IdSchema,
  question: z.string().min(1),
  expected_answer: z.string().min(1),
  expected_sources: z.array(IdSchema).nullable().optional(),
  notebook_id: IdSchema,
  created_at: IsoTimestampSchema,
});
export type EvalItem = z.infer<typeof EvalItemSchema>;

export const EvalDatasetSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  notebook_id: IdSchema.nullable().optional(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type EvalDataset = z.infer<typeof EvalDatasetSchema>;

export const EvalDatasetCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  notebook_id: IdSchema.nullable().optional(),
});
export type EvalDatasetCreate = z.infer<typeof EvalDatasetCreateSchema>;

export const EvalItemCreateSchema = z.object({
  question: z.string().min(1),
  expected_answer: z.string().min(1),
  expected_sources: z.array(IdSchema).nullable().optional(),
  notebook_id: IdSchema,
});
export type EvalItemCreate = z.infer<typeof EvalItemCreateSchema>;

// ---------------------------------------------------------------------------
// Runs + run items
// ---------------------------------------------------------------------------

export const EvalRunStatusSchema = z.enum(['running', 'completed', 'failed', 'cancelled']);
export type EvalRunStatus = z.infer<typeof EvalRunStatusSchema>;

export const EvalRunSchema = z.object({
  id: IdSchema,
  dataset_id: IdSchema,
  strategy_ids: z.array(z.string()),
  status: EvalRunStatusSchema,
  started_at: IsoTimestampSchema,
  finished_at: IsoTimestampSchema.nullable().optional(),
  summary: JsonMetadataSchema.nullable().optional(),
});
export type EvalRun = z.infer<typeof EvalRunSchema>;

export const EvalMetricsSchema = z.object({
  faithfulness: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  recall: z.number().min(0).max(1).nullable().optional(),
  precision: z.number().min(0).max(1).nullable().optional(),
  latency_ms: z.number().int().nonnegative(),
  explanation: z.string().nullable().optional(),
});
export type EvalMetrics = z.infer<typeof EvalMetricsSchema>;

export const EvalRunItemSchema = z.object({
  id: IdSchema,
  run_id: IdSchema,
  item_id: IdSchema,
  strategy_id: z.string(),
  question: z.string(),
  answer: z.string(),
  retrieved_source_ids: z.array(IdSchema).default([]),
  metrics: EvalMetricsSchema,
  created_at: IsoTimestampSchema,
});
export type EvalRunItem = z.infer<typeof EvalRunItemSchema>;

// ---------------------------------------------------------------------------
// Runner request (CLI / endpoint)
// ---------------------------------------------------------------------------

export const EvalRunRequestSchema = z.object({
  dataset_id: IdSchema,
  strategy_ids: z.array(z.string()).min(1),
});
export type EvalRunRequest = z.infer<typeof EvalRunRequestSchema>;
