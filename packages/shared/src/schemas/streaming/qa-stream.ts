// QA streaming event schemas — SSE events for the /v2/qa/stream endpoint.
//
// The event contract is backward-compatible with the v1 frontend chat consumer
// (`useChat.ts`): `chunk` | `state_snapshot` | `done` | `error`.
// The v2 server relays Vercel AI SDK `fullStream` parts into these events so
// the existing frontend renderer works with minimal adaptation.
import { z } from 'zod';

import { CitationSchema, IdSchema, JsonMetadataSchema } from '../common.js';
import { ChatTurnSchema } from '../message.js';

export const QaStreamChunkEventSchema = z.object({
  text: z.string(),
});

export const QaStreamStateSnapshotSchema = z.object({
  message_id: IdSchema.nullable().optional(),
  shared_state: JsonMetadataSchema.optional(),
});

export const QaStreamDoneEventSchema = z.object({
  message_id: IdSchema.nullable().optional(),
  citations: z.array(CitationSchema).default([]),
  /** Tool calls executed during the agent loop (for transparent UI). */
  tool_calls: z
    .array(
      z.object({
        name: z.string(),
        args: JsonMetadataSchema,
        result: JsonMetadataSchema.nullable().optional(),
      }),
    )
    .default([]),
});

export const QaStreamErrorEventSchema = z.object({
  message: z.string(),
  error_code: z.string().optional(),
});

/** Request body for POST /v2/qa/stream. */
export const QaStreamRequestSchema = z.object({
  session_id: IdSchema,
  question: z.string().min(1),
  /** Optional prior turns for multi-turn context (excludes the new question). */
  history: z.array(ChatTurnSchema).default([]),
  /** Override the default chat model id. */
  model_id: z.string().optional(),
  /** RAG strategy id (defaults to the notebook's active strategy). */
  strategy_id: z.string().optional(),
  top_k: z.number().int().positive().max(50).optional(),
});
export type QaStreamRequest = z.infer<typeof QaStreamRequestSchema>;

/** Non-streaming QA response (POST /v2/qa/ask). */
export const QaAnswerSchema = z.object({
  message_id: IdSchema,
  answer: z.string(),
  citations: z.array(CitationSchema).default([]),
  created_at: z.string(),
});
export type QaAnswer = z.infer<typeof QaAnswerSchema>;

export const QaStreamEventNames = ['chunk', 'state_snapshot', 'done', 'error'] as const;
export type QaStreamEventName = (typeof QaStreamEventNames)[number];
