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
export type ExtractorPolicyMode = z.infer<typeof ExtractorPolicyModeSchema>;

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
// Source connector bindings (filesystem / vault connectors)
// ---------------------------------------------------------------------------

export const ConnectorDiagnosticSchema = z.object({
  errorCode: z.string(),
  message: z.string(),
  hint: z.string().nullable().optional(),
  details: z.unknown().optional(),
});
export type ConnectorDiagnostic = z.infer<typeof ConnectorDiagnosticSchema>;

export const SourceConnectorCapabilitiesSchema = z.object({
  supportsSnapshot: z.boolean(),
  supportsSyncCheck: z.boolean(),
});
export type SourceConnectorCapabilities = z.infer<typeof SourceConnectorCapabilitiesSchema>;

export const SourceConnectorDescriptorSchema = z.object({
  connectorId: z.string().min(1),
  displayName: z.string(),
  description: z.string().nullable().optional(),
  connectionConfigSchema: JsonMetadataSchema,
  diagnostics: z.array(ConnectorDiagnosticSchema).nullable().optional(),
  capabilities: SourceConnectorCapabilitiesSchema,
});
export type SourceConnectorDescriptor = z.infer<typeof SourceConnectorDescriptorSchema>;

export const SourceConnectorsListResponseSchema = z.object({
  connectors: z.array(SourceConnectorDescriptorSchema),
});
export type SourceConnectorsListResponse = z.infer<typeof SourceConnectorsListResponseSchema>;

export const FrontmatterSummarySchema = z.object({
  title: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  aliases: z.array(z.string()).nullable().optional(),
  date: z.string().nullable().optional(),
});
export type FrontmatterSummary = z.infer<typeof FrontmatterSummarySchema>;

export const SnapshotEntrySchema = z.object({
  relativePath: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  modifiedAt: IsoTimestampSchema,
  contentHash: z.string().optional(),
  frontmatterSummary: FrontmatterSummarySchema.optional(),
});
export type SnapshotEntry = z.infer<typeof SnapshotEntrySchema>;

export const SnapshotSchema = z.object({
  generatedAt: IsoTimestampSchema,
  entries: z.array(SnapshotEntrySchema),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export const ImportScopeSchema = z.object({
  includeDirectories: z.array(z.string()).nullable().optional(),
  includeFiles: z.array(z.string()).nullable().optional(),
});
export type ImportScope = z.infer<typeof ImportScopeSchema>;

export const SyncCandidateSchema = z.object({
  relativePath: z.string(),
  current: SnapshotEntrySchema.nullable().optional(),
  base: SnapshotEntrySchema.nullable().optional(),
  reason: z.string().nullable().optional(),
});
export type SyncCandidate = z.infer<typeof SyncCandidateSchema>;

export const SyncCandidatesSchema = z.object({
  added: z.array(SyncCandidateSchema),
  updated: z.array(SyncCandidateSchema),
  missing: z.array(SyncCandidateSchema),
});
export type SyncCandidates = z.infer<typeof SyncCandidatesSchema>;

export const SyncCheckResultSchema = z.object({
  id: z.string().min(1),
  checkedAt: IsoTimestampSchema,
  baseSnapshot: SnapshotSchema.nullable().optional(),
  currentSnapshot: SnapshotSchema,
  candidates: SyncCandidatesSchema,
});
export type SyncCheckResult = z.infer<typeof SyncCheckResultSchema>;

export const SourceConnectorBindingSchema = z.object({
  id: IdSchema,
  notebookId: IdSchema,
  connectorId: z.string().min(1).max(128),
  connectionConfig: JsonMetadataSchema,
  importScope: ImportScopeSchema.nullable().optional(),
  lastConfirmedSnapshot: SnapshotSchema.nullable().optional(),
  lastSyncCheckResult: SyncCheckResultSchema.nullable().optional(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type SourceConnectorBinding = z.infer<typeof SourceConnectorBindingSchema>;

/** POST …/source-connectors/:connectorId/bindings */
export const SourceConnectorBindingCreateRequestSchema = z.object({
  connectionConfig: JsonMetadataSchema.default({}),
});
export type SourceConnectorBindingCreateRequest = z.infer<
  typeof SourceConnectorBindingCreateRequestSchema
>;

/** POST …/sync-check/apply */
export const SyncCheckApplyRequestSchema = z.object({
  syncCheckId: z.string().min(1),
});
export type SyncCheckApplyRequest = z.infer<typeof SyncCheckApplyRequestSchema>;

export const ImportResultStatusSchema = z.enum(['imported', 'reused', 'skipped', 'failed']);
export type ImportResultStatus = z.infer<typeof ImportResultStatusSchema>;

export const ImportResultItemSchema = z.object({
  relativePath: z.string(),
  status: ImportResultStatusSchema,
  sourceId: IdSchema.nullable().optional(),
  diagnostic: ConnectorDiagnosticSchema.nullable().optional(),
});
export type ImportResultItem = z.infer<typeof ImportResultItemSchema>;

export const ImportScopeApplyResponseSchema = z.object({
  binding: SourceConnectorBindingSchema,
  importedSourceIds: z.array(IdSchema),
  reusedSourceIds: z.array(IdSchema),
  results: z.array(ImportResultItemSchema),
});
export type ImportScopeApplyResponse = z.infer<typeof ImportScopeApplyResponseSchema>;

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
export type PatchNotebookExtractorPolicy = z.infer<typeof PatchNotebookExtractorPolicySchema>;
/** UI/local policy view — same fields as patch body (no notebookId/timestamps). */
export type NotebookExtractorsPolicyView = PatchNotebookExtractorPolicy;

// ---------------------------------------------------------------------------
// URL ingestion + web extraction
// ---------------------------------------------------------------------------

export const SourceFromUrlModeSchema = z.enum(['fetch', 'link']);
export type SourceFromUrlMode = z.infer<typeof SourceFromUrlModeSchema>;

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

/** Query params for flat POST /v2/sources/upload (multipart body is not Zod-validated). */
export const SourceUploadQuerySchema = z.object({
  notebookId: z.coerce.number().int().positive(),
  dedupAction: z.enum(['prompt', 'reuse', 'create_new']).default('prompt'),
});
export type SourceUploadQuery = z.infer<typeof SourceUploadQuerySchema>;

/**
 * Nested POST /v2/notebooks/:nid/sources/upload — path `:nid` is SSOT;
 * optional query notebookId must match when present.
 */
export const SourceUploadNestedQuerySchema = z.object({
  notebookId: z.coerce.number().int().positive().optional(),
  dedupAction: z.enum(['prompt', 'reuse', 'create_new']).default('prompt'),
});
export type SourceUploadNestedQuery = z.infer<typeof SourceUploadNestedQuerySchema>;

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
export type ExtractorInfo = z.infer<typeof ExtractorInfoSchema>;

export const ExtractorsListSchema = z.object({
  extractors: z.array(ExtractorInfoSchema),
  defaultExtractor: z.string().nullable().optional(),
  fallbackEnabled: z.boolean().default(true),
  policy: NotebookExtractorPolicySchema,
});
export type ExtractorsList = z.infer<typeof ExtractorsListSchema>;

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
export type SourceSearchResult = z.infer<typeof SourceSearchResultSchema>;

export const SourceSearchStatusSchema = z.enum(['ok', 'not_implemented', 'no_results']);
export type SourceSearchStatus = z.infer<typeof SourceSearchStatusSchema>;

export const SourceSearchResponseSchema = z.object({
  status: SourceSearchStatusSchema,
  query: z.string(),
  engine: z.string(),
  mode: z.string(),
  results: z.array(SourceSearchResultSchema),
  message: z.string().nullable().optional(),
  createdAt: IsoTimestampSchema,
});
export type SourceSearchResponse = z.infer<typeof SourceSearchResponseSchema>;

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
  content: z.string().min(1),
});
export type QAMessage = z.infer<typeof QAMessageSchema>;

/** POST …/sources/:sid/qa-to-source — multi-turn messages OR single-turn Q/A. */
export const ConvertSourceQAToSourceRequestSchema = z
  .object({
    messages: z.array(QAMessageSchema).min(1).optional(),
    question: z.string().optional(),
    answer: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const hasMessages = (v.messages?.length ?? 0) > 0;
    const hasPair = Boolean(v.question?.trim() && v.answer?.trim());
    if (!hasMessages && !hasPair) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide messages[] or question+answer',
      });
    }
  });
export type ConvertSourceQAToSourceRequest = z.infer<typeof ConvertSourceQAToSourceRequestSchema>;

export const ConvertSourceQAToSourceResponseSchema = z.object({
  sourceId: IdSchema,
  filename: z.string(),
  chunkCount: z.number().int().nonnegative(),
});

export const SourceTagBindingResponseSchema = z.object({
  tagId: IdSchema,
  sourceIds: z.array(IdSchema),
  applied: z.number().int().nonnegative().optional(),
  removed: z.number().int().nonnegative().optional(),
  skipped: z.number().int().nonnegative(),
  results: z.array(SourceBatchItemResultSchema),
});
export type SourceTagBindingResponse = z.infer<typeof SourceTagBindingResponseSchema>;
