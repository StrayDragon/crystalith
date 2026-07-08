// Research agent schemas — research sessions, steps, search plan/results,
// streaming progress events. Mirrors v1 `features.research.{schemas,types}`.
import { z } from 'zod';

import {
  IdSchema,
  IsoTimestampSchema,
  JsonMetadataSchema,
  OptionalTimestampSchema,
} from './common.js';

export const ResearchStatusSchema = z.enum([
  'planning',
  'searching',
  'analyzing',
  'waiting_user',
  'completed',
  'cancelled',
]);
export type ResearchStatus = z.infer<typeof ResearchStatusSchema>;

export const ResearchStepTypeSchema = z.enum([
  'plan',
  'search',
  'analyze',
  'user_input',
  'summary',
]);
export type ResearchStepType = z.infer<typeof ResearchStepTypeSchema>;

export const ResearchStepStatusSchema = z.enum(['pending', 'running', 'completed', 'skipped']);
export type ResearchStepStatus = z.infer<typeof ResearchStepStatusSchema>;

// ---------------------------------------------------------------------------
// Session + step entities
// ---------------------------------------------------------------------------

export const ResearchSessionSchema = z.object({
  id: IdSchema,
  notebook_id: IdSchema,
  topic: z.string().min(1),
  status: ResearchStatusSchema,
  current_iteration: z.number().int().positive(),
  max_iterations: z.number().int().positive(),
  aggregated_results: z.array(JsonMetadataSchema).nullable().optional(),
  final_report: z.string().nullable().optional(),
  locked_at: OptionalTimestampSchema,
  lock_expires_at: OptionalTimestampSchema,
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type ResearchSession = z.infer<typeof ResearchSessionSchema>;

export const ResearchSessionCreateSchema = z.object({
  topic: z.string().min(1),
  max_iterations: z.number().int().positive().max(10).optional(),
});
export type ResearchSessionCreate = z.infer<typeof ResearchSessionCreateSchema>;

export const ResearchStepSchema = z.object({
  id: IdSchema,
  session_id: IdSchema,
  iteration: z.number().int().positive(),
  type: ResearchStepTypeSchema,
  input_data: JsonMetadataSchema.nullable().optional(),
  output_data: JsonMetadataSchema.nullable().optional(),
  status: ResearchStepStatusSchema,
  created_at: IsoTimestampSchema,
});
export type ResearchStep = z.infer<typeof ResearchStepSchema>;

export const ResearchSessionListSchema = z.object({
  sessions: z.array(ResearchSessionSchema),
});

// ---------------------------------------------------------------------------
// Search plan + results (used in streaming events + step payloads)
// ---------------------------------------------------------------------------

export const SearchQuerySchema = z.object({
  query: z.string(),
  engine: z.string().default('Web'),
  priority: z.number().int().default(1),
  reason: z.string().default(''),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchPlanSchema = z.object({
  iteration: z.number().int().positive(),
  queries: z.array(SearchQuerySchema).default([]),
  reasoning: z.string().default(''),
  estimated_results: z.number().int().default(10),
});
export type SearchPlan = z.infer<typeof SearchPlanSchema>;

export const ResearchSearchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string().default(''),
  source: z.string().default(''),
  iteration: z.number().int().default(1),
  relevance_score: z.number().default(0),
});
export type ResearchSearchResult = z.infer<typeof ResearchSearchResultSchema>;

export const IterationAnalysisSchema = z.object({
  iteration: z.number().int().positive(),
  result_count: z.number().int().nonnegative(),
  coverage: z.number().min(0).max(1),
  summary: z.string(),
  need_more_search: z.boolean(),
  suggested_queries: z.array(z.string()).default([]),
});
export type IterationAnalysis = z.infer<typeof IterationAnalysisSchema>;

export const ResearchOutputTypeSchema = z.enum([
  'report',
  'sub_report',
  'reference',
  'link',
  'raw_result',
]);

export const ResearchOutputSchema = z.object({
  type: ResearchOutputTypeSchema,
  title: z.string(),
  content: z.string(),
  url: z.string().nullable().optional(),
  source_iteration: z.number().int().default(1),
  relevance_score: z.number().default(0),
  snippet: z.string().default(''),
  citation_index: z.number().int().nullable().optional(),
  can_export_as_source: z.boolean().default(true),
  can_export_as_note: z.boolean().default(true),
  recommended_extractor: z.string().nullable().optional(),
});
export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;

// ---------------------------------------------------------------------------
// User action on a waiting_user session
// ---------------------------------------------------------------------------

export const ResearchUserActionSchema = z.enum(['approve', 'modify', 'skip', 'finish']);
export type ResearchUserAction = z.infer<typeof ResearchUserActionSchema>;

export const ResearchUserInputSchema = z.object({
  action: ResearchUserActionSchema,
  modified_plan: SearchPlanSchema.nullable().optional(),
  message: z.string().optional(),
});
