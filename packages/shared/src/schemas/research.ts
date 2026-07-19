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
  notebookId: IdSchema,
  topic: z.string().min(1),
  status: ResearchStatusSchema,
  currentIteration: z.number().int().positive(),
  maxIterations: z.number().int().positive(),
  aggregatedResults: z.array(JsonMetadataSchema).nullable().optional(),
  finalReport: z.string().nullable().optional(),
  lockedAt: OptionalTimestampSchema,
  lockExpiresAt: OptionalTimestampSchema,
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type ResearchSession = z.infer<typeof ResearchSessionSchema>;

export const ResearchSessionCreateBodySchema = z.object({
  /** Canonical topic; some clients send `goal` instead. */
  topic: z.string().min(1).optional(),
  goal: z.string().min(1).optional(),
  maxIterations: z.number().int().positive().max(10).optional(),
});
export type ResearchSessionCreateBody = z.infer<typeof ResearchSessionCreateBodySchema>;

/** Flat alias POST /v2/research — notebookId required. */
export const ResearchSessionCreateSchema = ResearchSessionCreateBodySchema.extend({
  notebookId: IdSchema,
});
export type ResearchSessionCreate = z.infer<typeof ResearchSessionCreateSchema>;

/** Nested POST /v2/notebooks/:nid/research — optional body notebookId must match path. */
export const ResearchSessionCreateNestedSchema = ResearchSessionCreateBodySchema.extend({
  notebookId: IdSchema.optional(),
});
export type ResearchSessionCreateNested = z.infer<typeof ResearchSessionCreateNestedSchema>;

export const ResearchStepSchema = z.object({
  id: IdSchema,
  sessionId: IdSchema,
  iteration: z.number().int().positive(),
  type: ResearchStepTypeSchema,
  inputData: JsonMetadataSchema.nullable().optional(),
  outputData: JsonMetadataSchema.nullable().optional(),
  status: ResearchStepStatusSchema,
  createdAt: IsoTimestampSchema,
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
  estimatedResults: z.number().int().default(10),
});
export type SearchPlan = z.infer<typeof SearchPlanSchema>;

/**
 * LLM `generateObject` plan shape (agent). Subset of step/wire plan:
 * no iteration / estimatedResults — those live on the step or SSE envelope.
 */
export const ResearchPlanLlmSchema = z.object({
  queries: z
    .array(
      z.object({
        query: z.string(),
        engine: z.string().default('Web'),
        priority: z.number().min(1).max(3).default(1),
        reason: z.string(),
      }),
    )
    .min(1)
    .max(5),
  reasoning: z.string(),
});
export type ResearchPlanLlm = z.infer<typeof ResearchPlanLlmSchema>;

export const ResearchSearchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string().default(''),
  source: z.string().default(''),
  iteration: z.number().int().default(1),
  relevanceScore: z.number().default(0),
});
export type ResearchSearchResult = z.infer<typeof ResearchSearchResultSchema>;

export const IterationAnalysisSchema = z.object({
  iteration: z.number().int().positive(),
  resultCount: z.number().int().nonnegative(),
  coverageEstimate: z.number().min(0).max(1),
  summary: z.string(),
  needMore: z.boolean(),
  suggestedQueries: z.array(z.string()).default([]),
});
export type IterationAnalysis = z.infer<typeof IterationAnalysisSchema>;

/** LLM `generateObject` + step.outputData / SSE `data` analysis payload. */
export const IterationAnalysisLlmSchema = IterationAnalysisSchema.pick({
  summary: true,
  coverageEstimate: true,
  needMore: true,
  suggestedQueries: true,
});
export type IterationAnalysisLlm = z.infer<typeof IterationAnalysisLlmSchema>;

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
  sourceIteration: z.number().int().default(1),
  relevanceScore: z.number().default(0),
  snippet: z.string().default(''),
  citationIndex: z.number().int().nullable().optional(),
  canExportAsSource: z.boolean().default(true),
  canExportAsNote: z.boolean().default(true),
  recommendedExtractor: z.string().nullable().optional(),
});
export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;

// ---------------------------------------------------------------------------
// User action on a waiting_user session
// ---------------------------------------------------------------------------

export const ResearchUserActionSchema = z.enum(['approve', 'modify', 'skip', 'finish']);
export type ResearchUserAction = z.infer<typeof ResearchUserActionSchema>;

export const ResearchUserInputSchema = z.object({
  action: ResearchUserActionSchema,
  modifiedPlan: SearchPlanSchema.nullable().optional(),
  message: z.string().optional(),
});
