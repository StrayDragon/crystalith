// Research progress streaming events — SSE for /v2/research/:id/stream.
//
// Wire contract (scheme A):
//   - SSE `event:` line = channel name (plan_ready, done, …) — see ResearchProgressEventNames
//   - JSON `data:` body uses discriminant field `type` (NOT `event`) matching runtime emits
//
// `done` payload matches apps/server research/router.ts + asyncapi.ts exactly.
import { z } from 'zod';

import { IdSchema, JsonMetadataSchema } from '../common.js';
import {
  IterationAnalysisLlmSchema,
  ResearchPlanLlmSchema,
  ResearchSearchResultSchema,
} from '../research.js';

export const ResearchProgressEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('plan_ready'),
    sessionId: IdSchema.optional(),
    iteration: z.number().int().optional(),
    /** Prefer envelope `data` (step.outputData); `plan` optional mirror. */
    plan: ResearchPlanLlmSchema.optional(),
    data: JsonMetadataSchema.optional(),
  }),
  z.object({
    type: z.literal('search_result'),
    sessionId: IdSchema.optional(),
    iteration: z.number().int().optional(),
    result: ResearchSearchResultSchema.optional(),
    data: JsonMetadataSchema.optional(),
  }),
  z.object({
    type: z.literal('analysis'),
    sessionId: IdSchema.optional(),
    iteration: z.number().int().optional(),
    /** LLM analysis shape; iteration lives on the SSE envelope. */
    analysis: IterationAnalysisLlmSchema.nullable().optional(),
    data: JsonMetadataSchema.optional(),
  }),
  z.object({
    type: z.literal('thinking'),
    sessionId: IdSchema.optional(),
    iteration: z.number().int().optional(),
    message: z.string().optional(),
    stepType: z.string().optional(),
    data: JsonMetadataSchema.optional(),
  }),
  /** Status transition (poll-derived; v1 api.py status events). */
  z.object({
    type: z.literal('status'),
    status: z.string(),
    previous: z.string().nullable().optional(),
    iteration: z.number().int().optional(),
    message: z.string().optional(),
    sessionId: IdSchema.optional(),
  }),
  z.object({
    type: z.literal('progress'),
    sessionId: IdSchema.optional(),
    data: JsonMetadataSchema.optional(),
  }),
  z.object({
    type: z.literal('search_progress'),
    iteration: z.number().int().optional(),
    data: JsonMetadataSchema.optional(),
  }),
  z.object({
    type: z.literal('approval_request'),
    iteration: z.number().int().optional(),
    data: JsonMetadataSchema.optional(),
  }),
  z.object({
    type: z.literal('report'),
    iteration: z.number().int().optional(),
    data: JsonMetadataSchema.optional(),
  }),
  /** Matches runtime: emit('done', { type, status, totalResults, hasReport }) */
  z.object({
    type: z.literal('done'),
    status: z.string(),
    totalResults: z.number(),
    hasReport: z.boolean(),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
    sessionId: IdSchema.optional(),
  }),
]);
export type ResearchProgressEvent = z.infer<typeof ResearchProgressEventSchema>;

/** SSE `event:` line names (not the JSON `type` field). */
export const ResearchProgressEventNames = [
  'plan_ready',
  'search_result',
  'search_progress',
  'analysis',
  'thinking',
  'progress',
  'waiting',
  'report',
  'done',
  'error',
  'heartbeat',
  'status',
] as const;
export type ResearchProgressEventName = (typeof ResearchProgressEventNames)[number];
