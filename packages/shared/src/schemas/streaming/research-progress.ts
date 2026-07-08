// Research progress streaming events — SSE for /v2/research/sessions/:id/stream.
//
// Relays the research agent loop (plan → search → analyze → summary) to the
// frontend research panel. Mirrors v1 research graph callbacks.
import { z } from 'zod';

import { IdSchema, JsonMetadataSchema } from '../common.js';
import {
  IterationAnalysisSchema,
  ResearchSearchResultSchema,
  SearchPlanSchema,
} from '../research.js';

export const ResearchProgressEventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('plan_ready'),
    session_id: IdSchema,
    plan: SearchPlanSchema,
  }),
  z.object({
    event: z.literal('search_result'),
    session_id: IdSchema,
    result: ResearchSearchResultSchema,
  }),
  z.object({
    event: z.literal('analysis'),
    session_id: IdSchema,
    analysis: IterationAnalysisSchema.nullable(),
  }),
  z.object({
    event: z.literal('thinking'),
    session_id: IdSchema,
    data: JsonMetadataSchema,
  }),
  z.object({
    event: z.literal('progress'),
    session_id: IdSchema,
    data: JsonMetadataSchema,
  }),
  z.object({
    event: z.literal('done'),
    session_id: IdSchema,
    final_report: z.string().nullable().optional(),
    outputs: z
      .array(
        z.object({
          type: z.enum(['report', 'sub_report', 'reference', 'link', 'raw_result']),
          title: z.string(),
          content: z.string(),
        }),
      )
      .default([]),
  }),
  z.object({
    event: z.literal('error'),
    session_id: IdSchema,
    message: z.string(),
  }),
]);
export type ResearchProgressEvent = z.infer<typeof ResearchProgressEventSchema>;

export const ResearchProgressEventNames = [
  'plan_ready',
  'search_result',
  'analysis',
  'thinking',
  'progress',
  'done',
  'error',
] as const;
export type ResearchProgressEventName = (typeof ResearchProgressEventNames)[number];
