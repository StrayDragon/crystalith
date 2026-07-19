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
  messageId: IdSchema.nullable().optional(),
  sharedState: JsonMetadataSchema.optional(),
});

export const QaStreamDoneEventSchema = z.object({
  messageId: IdSchema.nullable().optional(),
  citations: z.array(CitationSchema).default([]),
  /** Tool calls executed during the agent loop (for transparent UI). */
  toolCalls: z
    .array(
      z.object({
        name: z.string(),
        args: JsonMetadataSchema,
        result: JsonMetadataSchema.nullable().optional(),
      }),
    )
    .default([]),
  /** Confidence score in [0,1] derived from evidence (similarity + coverage). */
  confidence: z.number().min(0).max(1).optional(),
  /** Reason for no evidence (mirrors v1 no_evidence_reason). */
  noEvidenceReason: z
    .enum(['no_sources', 'embedding_empty', 'no_vector_hits', 'no_valid_chunks', 'low_similarity'])
    .optional(),
});

export const QaStreamErrorEventSchema = z.object({
  message: z.string(),
  errorCode: z.string().optional(),
});

/** Request body for POST /v2/qa and POST /v2/qa/stream. */
export const QaDirectiveSchema = z.enum(['Sources_only', 'Knowledge_only', 'Mixed']);
export type QaDirective = z.infer<typeof QaDirectiveSchema>;

const QaRequestFieldsSchema = z.object({
  question: z.string().min(1).optional(),
  /** Alias used by some clients for `question`. */
  content: z.string().min(1).optional(),
  sessionId: IdSchema.optional(),
  preset: z.string().max(32).optional(),
  directive: QaDirectiveSchema.optional(),
  strategyId: z.string().optional(),
  topK: z.number().int().positive().max(50).optional(),
  minScore: z.number().min(0).max(1).optional(),
  sourceIds: z.array(IdSchema).optional(),
  /** Legacy stream-only fields (ignored by server if present). */
  history: z.array(ChatTurnSchema).optional(),
  modelId: z.string().optional(),
});

/** Flat alias POST /v2/qa — notebookId required. */
export const QaRequestSchema = QaRequestFieldsSchema.extend({
  notebookId: IdSchema,
}).refine((b) => !!(b.question ?? b.content), { message: 'question is required' });
export type QaRequest = z.infer<typeof QaRequestSchema>;

/** Nested POST /v2/notebooks/:nid/qa — optional body notebookId must match path. */
export const QaNestedRequestSchema = QaRequestFieldsSchema.extend({
  notebookId: IdSchema.optional(),
}).refine((b) => !!(b.question ?? b.content), { message: 'question is required' });
export type QaNestedRequest = z.infer<typeof QaNestedRequestSchema>;

/** @deprecated Prefer QaRequestSchema — kept as alias for older imports. */
export const QaStreamRequestSchema = QaRequestSchema;
export type QaStreamRequest = QaRequest;

/** Non-streaming QA response (POST /v2/qa). */
export const QaAnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(CitationSchema).default([]),
  messageId: IdSchema.nullable().optional(),
  sessionId: IdSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.unknown().optional(),
  noEvidenceReason: z.string().optional(),
});
export type QaAnswer = z.infer<typeof QaAnswerSchema>;

export const QaExportQuerySchema = z.object({
  sessionId: z.coerce.number().int().positive(),
  messageId: z.coerce.number().int().positive().optional(),
  format: z.enum(['markdown', 'json']).default('markdown'),
});
export type QaExportQuery = z.infer<typeof QaExportQuerySchema>;

export const QaStreamEventNames = ['chunk', 'state_snapshot', 'done', 'error'] as const;
export type QaStreamEventName = (typeof QaStreamEventNames)[number];
