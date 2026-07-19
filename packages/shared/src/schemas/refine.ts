// Refine schemas — citation-aware RAG summarizer (v1-aligned).
//
// Mirrors v1 `features/refine/api.py` request/response models:
//   - three formats: paragraph / bullets / structured
//   - retrieval via source_ids → citations + evidence
//   - batch endpoint sharing one retrieval across formats
import { z } from 'zod';

import { CitationSchema, IdSchema, IsoTimestampSchema } from './common.js';

// ---------------------------------------------------------------------------
// Format enum + request
// ---------------------------------------------------------------------------

export const RefineFormatSchema = z.enum(['paragraph', 'bullets', 'structured']);
export type RefineFormat = z.infer<typeof RefineFormatSchema>;

export const RefineRequestSchema = z.object({
  notebookId: IdSchema,
  prompt: z.string().min(1),
  format: RefineFormatSchema.default('paragraph'),
  sourceIds: z.array(IdSchema).optional(),
  topK: z.number().int().min(1).max(20).default(5),
  minScore: z.number().min(0).max(1).default(0.2),
});
export type RefineRequest = z.infer<typeof RefineRequestSchema>;

export const RefineBatchRequestSchema = z.object({
  notebookId: IdSchema,
  prompt: z.string().min(1),
  formats: z.array(RefineFormatSchema).optional(),
  sourceIds: z.array(IdSchema).optional(),
  topK: z.number().int().min(1).max(20).default(5),
  minScore: z.number().min(0).max(1).default(0.2),
});
export type RefineBatchRequest = z.infer<typeof RefineBatchRequestSchema>;

// ---------------------------------------------------------------------------
// Response shapes (v1 RefineResponse / StructuredRefine / RefineBatchResponse)
// ---------------------------------------------------------------------------

export const StructuredRefineSchema = z.object({
  title: z.string(),
  bullets: z.array(z.string()),
  terms: z.array(z.string()),
  citations: z.array(CitationSchema),
});
export type StructuredRefine = z.infer<typeof StructuredRefineSchema>;

export const RefineResponseSchema = z.object({
  format: RefineFormatSchema,
  paragraph: z.string().nullable().optional(),
  bullets: z.array(z.string()).nullable().optional(),
  structured: StructuredRefineSchema.nullable().optional(),
  citations: z.array(CitationSchema),
  evidence: z.boolean(),
  createdAt: IsoTimestampSchema,
});
export type RefineResponse = z.infer<typeof RefineResponseSchema>;

export const RefineBatchOutputSchema = z.object({
  paragraph: z.string().nullable().optional(),
  bullets: z.array(z.string()).nullable().optional(),
  structured: StructuredRefineSchema.nullable().optional(),
});
export type RefineBatchOutput = z.infer<typeof RefineBatchOutputSchema>;

export const RefineBatchResponseSchema = z.object({
  outputs: z.record(z.string(), RefineBatchOutputSchema),
  citations: z.array(CitationSchema),
  evidence: z.boolean(),
  createdAt: IsoTimestampSchema,
});
export type RefineBatchResponse = z.infer<typeof RefineBatchResponseSchema>;
