// Source schemas — sources, chunks, tags, connector bindings, extractor policy,
// URL fetch, source search/QA/summary. Mirrors v1 `features.sources.api_schemas`.
import { z } from 'zod';

import {
  IdSchema,
  IsoTimestampSchema,
  JsonMetadataSchema,
  OptionalTimestampSchema,
} from './common.js';
import { desc } from './i18n.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const SourceStatusSchema = z.enum(['processing', 'ready', 'failed']);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

export const ExtractorPolicyModeSchema = z.enum(['inherit_global', 'custom']);

// ---------------------------------------------------------------------------
// Chunk
// ---------------------------------------------------------------------------

export const ChunkSchema = z.object({
  id: IdSchema,
  chunkIndex: z.number().int().nonnegative(),
  text: z.string(),
  startOffset: z.number().int().nullable().optional(),
  endOffset: z.number().int().nullable().optional(),
  metadata: JsonMetadataSchema.nullable().optional(),
});
export type Chunk = z.infer<typeof ChunkSchema>;

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

export const SourceSchema = z.object({
  id: IdSchema.describe(desc('source.id')),
  notebookId: IdSchema,
  filename: z.string().min(1).max(512).describe(desc('source.title')),
  mimeType: z.string().nullable().optional(),
  parserType: z.string().min(1).max(64),
  metadata: JsonMetadataSchema.nullable().optional(),
  dedupKey: z.string().nullable().optional(),
  status: SourceStatusSchema.describe(desc('source.status')),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  recoveryHint: z.string().nullable().optional(),
  lastErrorAt: OptionalTimestampSchema,
  chunkCount: z.number().int().nonnegative().default(0),
  tags: z.array(z.string()).default([]),
  createdAt: IsoTimestampSchema.describe(desc('source.created_at')),
  updatedAt: IsoTimestampSchema.describe(desc('source.updated_at')),
});
export type Source = z.infer<typeof SourceSchema>;

export const SourceCreateSchema = z.object({
  filename: z.string().min(1).max(512),
  content: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  parserType: z.string().min(1).max(64).default('text'),
  metadata: JsonMetadataSchema.nullable().optional(),
});
export type SourceCreate = z.infer<typeof SourceCreateSchema>;

export const SourceListSchema = z.object({
  sources: z.array(SourceSchema),
});

// ---------------------------------------------------------------------------
// Source tags
// ---------------------------------------------------------------------------

export const SourceTagSchema = z.object({
  id: IdSchema,
  notebookId: IdSchema,
  name: z.string().min(1).max(64),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type SourceTag = z.infer<typeof SourceTagSchema>;

export const SourceTagCreateSchema = z.object({
  name: z.string().min(1).max(64),
});
export type SourceTagCreate = z.infer<typeof SourceTagCreateSchema>;

export const SourceTagBindingRequestSchema = z.object({
  sourceIds: z.array(IdSchema).min(1),
});

export const SourceBatchItemResultSchema = z.object({
  sourceId: IdSchema,
  ok: z.boolean(),
  errorCode: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
});

export const SourceBatchDeleteRequestSchema = z.object({
  sourceIds: z.array(IdSchema).min(1),
});

export const SourceBatchDeleteResponseSchema = z.object({
  results: z.array(SourceBatchItemResultSchema).default([]),
  deletedIds: z.array(IdSchema),
  deletedCount: z.number().int().nonnegative(),
});

export const SourceBatchReembedRequestSchema = z.object({
  sourceIds: z.array(IdSchema).min(1),
});

export const SourceBatchReembedResponseSchema = z.object({
  results: z.array(SourceBatchItemResultSchema).default([]),
  reembeddedIds: z.array(IdSchema),
  failedIds: z.array(IdSchema),
  reembeddedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
});

// ---------------------------------------------------------------------------
// Source connector bindings
// ---------------------------------------------------------------------------

export const SourceConnectorBindingSchema = z.object({
  id: IdSchema,
  notebookId: IdSchema,
  connectorId: z.string().min(1).max(128),
  connectionConfig: JsonMetadataSchema,
  importScope: JsonMetadataSchema.nullable().optional(),
  lastConfirmedSnapshot: JsonMetadataSchema.nullable().optional(),
  lastSyncCheckResult: JsonMetadataSchema.nullable().optional(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type SourceConnectorBinding = z.infer<typeof SourceConnectorBindingSchema>;

// ---------------------------------------------------------------------------
// Notebook extractor policy
// ---------------------------------------------------------------------------

export const NotebookExtractorPolicySchema = z.object({
  notebookId: IdSchema,
  mode: ExtractorPolicyModeSchema.default('inherit_global'),
  enabledExtractors: z.array(z.string()).nullable().optional(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type NotebookExtractorPolicy = z.infer<typeof NotebookExtractorPolicySchema>;

export const PatchNotebookExtractorPolicySchema = z.object({
  mode: ExtractorPolicyModeSchema.optional(),
  enabledExtractors: z.array(z.string()).nullable().optional(),
});

// ---------------------------------------------------------------------------
// URL ingestion + web extraction
// ---------------------------------------------------------------------------

export const SourceFromUrlModeSchema = z.enum(['fetch', 'link']);

export const SourceFromUrlRequestSchema = z
  .object({
    url: z
      .string()
      .url()
      .refine((v) => v.startsWith('http://') || v.startsWith('https://'), {
        message: 'url must start with http:// or https://',
      }),
    title: z.string().nullable().optional(),
    snippet: z.string().nullable().optional(),
    mode: SourceFromUrlModeSchema.default('link'),
    extractor: z
      .string()
      .nullable()
      .optional()
      .refine(
        (v) =>
          v === null ||
          v === undefined ||
          ['trafilatura', 'jina', 'firecrawl', 'browserless'].includes(v.toLowerCase()),
        { message: 'extractor must be one of: trafilatura, jina, firecrawl, browserless' },
      ),
  })
  .transform((v) => ({
    ...v,
    extractor: v.extractor === null || v.extractor === undefined ? null : v.extractor.toLowerCase(),
  }));
export type SourceFromUrlRequest = z.infer<typeof SourceFromUrlRequestSchema>;

export const ExtractorInfoSchema = z.object({
  type: z.string(),
  pluginId: z.string().nullable().optional(),
  enabled: z.boolean(),
  available: z.boolean(),
  displayName: z.string(),
  description: z.string(),
  priority: z.number().int(),
  requiresApiKey: z.boolean().default(false),
  requiresService: z.boolean().default(false),
  errorCode: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  recoveryHint: z.string().nullable().optional(),
  details: JsonMetadataSchema.nullable().optional(),
});

export const ExtractorsListSchema = z.object({
  extractors: z.array(ExtractorInfoSchema),
  defaultExtractor: z.string().nullable().optional(),
  fallbackEnabled: z.boolean().default(true),
  policy: NotebookExtractorPolicySchema,
});

// ---------------------------------------------------------------------------
// Source search (web)
// ---------------------------------------------------------------------------

export const SourceSearchRequestSchema = z.object({
  query: z.string().min(1),
  engine: z.string().default('Web'),
  mode: z.string().default('Fast Research'),
});

export const SourceSearchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

export const SourceSearchStatusSchema = z.enum(['ok', 'not_implemented']);

export const SourceSearchResponseSchema = z.object({
  status: SourceSearchStatusSchema,
  query: z.string(),
  engine: z.string(),
  mode: z.string(),
  results: z.array(SourceSearchResultSchema),
  message: z.string().nullable().optional(),
  createdAt: IsoTimestampSchema,
});

// ---------------------------------------------------------------------------
// Source summary + per-source QA
// ---------------------------------------------------------------------------

export const SourceSummarySchema = z.object({
  sourceId: IdSchema,
  summary: z.string(),
  keyPoints: z.array(z.string()),
  topics: z.array(z.string()),
  wordCount: z.number().int().nonnegative(),
  createdAt: IsoTimestampSchema,
});

export const SourceQARequestSchema = z.object({
  question: z.string().min(1),
});

export const SourceQAResponseSchema = z.object({
  sourceId: IdSchema,
  answer: z.string(),
  createdAt: IsoTimestampSchema,
});

export const QAMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export const ConvertSourceQAToSourceRequestSchema = z.object({
  messages: z.array(QAMessageSchema).min(1),
});

export const ConvertSourceQAToSourceResponseSchema = z.object({
  sourceId: IdSchema,
  filename: z.string(),
});
