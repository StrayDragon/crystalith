// Refine schemas — content refinement task queue.
// Mirrors v1 `features.refine` (paragraph/bullets/structured modes).
import { z } from 'zod';

import { IdSchema, IsoTimestampSchema, JsonMetadataSchema } from './common.js';

export const RefineModeSchema = z.enum(['paragraph', 'bullets', 'structured']);
export type RefineMode = z.infer<typeof RefineModeSchema>;

export const RefineStatusSchema = z.enum(['queued', 'running', 'done', 'error']);
export type RefineStatus = z.infer<typeof RefineStatusSchema>;

export const RefineRequestSchema = z.object({
  notebook_id: IdSchema,
  source_ids: z.array(IdSchema).optional(),
  chunk_ids: z.array(IdSchema).optional(),
  mode: RefineModeSchema.default('paragraph'),
  prompt: z.string().optional(),
  options: JsonMetadataSchema.optional(),
});
export type RefineRequest = z.infer<typeof RefineRequestSchema>;

export const RefineResultSchema = z.object({
  task_id: IdSchema,
  status: RefineStatusSchema,
  mode: RefineModeSchema,
  result: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type RefineResult = z.infer<typeof RefineResultSchema>;
