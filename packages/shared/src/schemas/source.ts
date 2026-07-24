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

export const SourceSchema = z
  .object({
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
  })
  .openapi({
    description: desc('source.entity', '来源实体'),
    example: {
      id: 1,
      notebookId: 1,
      filename: 'notes.md',
      parserType: 'text',
      status: 'ready',
      chunkCount: 3,
      tags: [],
      createdAt: '2026-07-08T12:00:00.000Z',
      updatedAt: '2026-07-08T12:00:00.000Z',
    },
  });
export type Source = z.infer<typeof SourceSchema>;

export const SourceCreateSchema = z
  .object({
    filename: z.string().min(1).max(512),
    content: z.string().nullable().optional(),
    mimeType: z.string().nullable().optional(),
    parserType: z.string().min(1).max(64).default('text'),
    metadata: JsonMetadataSchema.nullable().optional(),
  })
  .openapi({
    description: desc('source.create', '创建来源请求'),
    example: { filename: 'notes.md', parserType: 'text' },
  });
export type SourceCreate = z.infer<typeof SourceCreateSchema>;

export const SourceListSchema = z.object({
  sources: z.array(SourceSchema),
});

// ---------------------------------------------------------------------------
// Source tags
// ---------------------------------------------------------------------------

export const SourceTagSchema = z
  .object({
    id: IdSchema,
    notebookId: IdSchema,
    name: z.string().min(1).max(64),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
  })
  .openapi({
    description: desc('source.tag', '来源标签'),
    example: {
      id: 1,
      notebookId: 1,
      name: 'paper',
      createdAt: '2026-07-08T12:00:00.000Z',
      updatedAt: '2026-07-08T12:00:00.000Z',
    },
  });
export type SourceTag = z.infer<typeof SourceTagSchema>;

export const SourceTagCreateSchema = z
  .object({
    name: z.string().min(1).max(64),
  })
  .openapi({
    description: desc('source.tag_create', '创建来源标签'),
    example: { name: 'paper' },
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

export const SourceConnectorBindingSchema = z
  .object({
    id: IdSchema,
    notebookId: IdSchema,
    connectorId: z.string().min(1).max(128),
    connectionConfig: JsonMetadataSchema,
    importScope: ImportScopeSchema.nullable().optional(),
    lastConfirmedSnapshot: SnapshotSchema.nullable().optional(),
    lastSyncCheckResult: SyncCheckResultSchema.nullable().optional(),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
  })
  .openapi({
    description: desc('source.connector_binding', '来源连接器绑定'),
  });
export type SourceConnectorBinding = z.infer<typeof SourceConnectorBindingSchema>;

/** POST …/source-connectors/:connectorId/bindings */
export const SourceConnectorBindingCreateRequestSchema = z
  .object({
    connectionConfig: JsonMetadataSchema.default({}),
  })
  .openapi({
    description: desc('source.connector_binding_create', '创建连接器绑定'),
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
    url: z.url().refine((v) => v.startsWith('http://') || v.startsWith('https://'), {
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
  }))
  .openapi({
    description: desc('source.from_url', '从 URL 导入来源'),
    example: { url: 'https://example.com/doc', mode: 'link' },
  });
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

/** Fresh ingest result from POST …/sources/upload. */
export const SourceIngestResultSchema = z
  .object({
    sourceId: IdSchema,
    chunkCount: z.number().int().nonnegative(),
    text: z.string(),
    parserType: z.string(),
    status: SourceStatusSchema,
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
  })
  .openapi({
    description: desc('source.ingest_result', '摄取结果'),
    example: {
      sourceId: 1,
      chunkCount: 2,
      text: '…',
      parserType: 'text',
      status: 'ready',
    },
  });
export type SourceIngestResult = z.infer<typeof SourceIngestResultSchema>;

/** Dedup reuse branch for upload. */
export const SourceUploadReuseResultSchema = z
  .object({
    reused: z.literal(true),
    source: SourceSchema,
  })
  .openapi({
    description: desc('source.upload_reuse', '去重复用已有来源'),
  });
export type SourceUploadReuseResult = z.infer<typeof SourceUploadReuseResultSchema>;

export const SourceUploadResponseSchema = z
  .union([SourceIngestResultSchema, SourceUploadReuseResultSchema])
  .openapi({ description: desc('source.upload_response', '上传来源响应') });
export type SourceUploadResponse = z.infer<typeof SourceUploadResponseSchema>;

/** Link-mode success from POST …/sources/from-url (HTTP 201). */
export const SourceFromUrlLinkResultSchema = z
  .object({
    sourceId: IdSchema,
    filename: z.string(),
    mode: z.literal('link'),
  })
  .openapi({
    description: desc('source.from_url_link', '链接模式导入结果'),
    example: { sourceId: 1, filename: 'https://example.com', mode: 'link' },
  });
export type SourceFromUrlLinkResult = z.infer<typeof SourceFromUrlLinkResultSchema>;

/** Fetch-mode ingest success (optionally annotated with extractor metadata). */
export const SourceFromUrlFetchResultSchema = SourceIngestResultSchema.extend({
  extractedBy: z.string().optional(),
  title: z.string().nullable().optional(),
}).openapi({
  description: desc('source.from_url_fetch', '抓取模式导入结果'),
});
export type SourceFromUrlFetchResult = z.infer<typeof SourceFromUrlFetchResultSchema>;

/**
 * Success body for POST …/sources/from-url.
 * Dedup reuse shares upload reuse shape; errors use AppHttpError / ErrorEnvelope.
 */
export const SourceFromUrlResponseSchema = z
  .union([
    SourceUploadReuseResultSchema,
    SourceFromUrlLinkResultSchema,
    SourceFromUrlFetchResultSchema,
  ])
  .openapi({ description: desc('source.from_url_response', 'URL 导入响应') });
export type SourceFromUrlResponse = z.infer<typeof SourceFromUrlResponseSchema>;

export const SourceParserSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeTypes: z.array(z.string()),
  extensions: z.array(z.string()),
});
export type SourceParser = z.infer<typeof SourceParserSchema>;

export const SourceParserListSchema = SourceParserSchema.array();
export type SourceParserList = z.infer<typeof SourceParserListSchema>;

export const SourceReembedResponseSchema = z.object({
  sourceId: IdSchema,
  reEmbedded: z.literal(true),
});
export type SourceReembedResponse = z.infer<typeof SourceReembedResponseSchema>;

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

/** Nested policy on GET/PATCH extractors list (wire shape — not full DB policy row). */
export const ExtractorsListPolicySchema = z.object({
  mode: ExtractorPolicyModeSchema.default('inherit_global'),
  enabledExtractors: z.array(z.string()).nullable().optional(),
});
export type ExtractorsListPolicy = z.infer<typeof ExtractorsListPolicySchema>;

export const ExtractorsListSchema = z
  .object({
    notebookId: IdSchema.optional(),
    extractors: z.array(ExtractorInfoSchema),
    defaultExtractor: z.string().nullable().optional(),
    fallbackEnabled: z.boolean().default(true),
    policy: ExtractorsListPolicySchema,
  })
  .openapi({
    description: desc('source.extractors_list', '笔记本提取器策略与可用列表'),
  });
export type ExtractorsList = z.infer<typeof ExtractorsListSchema>;

// ---------------------------------------------------------------------------
// Source search (web)
// ---------------------------------------------------------------------------

export const SourceSearchRequestSchema = z
  .object({
    query: z.string().min(1),
    engine: z.string().default('Web'),
    /** Web-search channel metadata only — MUST NOT mean Deep Research / ResearchRun. */
    mode: z
      .string()
      .default('Fast Research')
      .openapi({
        description: desc(
          'source.search_mode',
          '网搜通道元数据（默认 Fast Research）；不是深度研究 / ResearchRun',
        ),
        example: 'Fast Research',
      }),
  })
  .openapi({
    description: desc('source.search_request', '网页搜索请求（与 Deep Research 无关）'),
    example: { query: 'RAG evaluation', engine: 'Web', mode: 'Fast Research' },
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

export const SourceSearchResponseSchema = z
  .object({
    status: SourceSearchStatusSchema,
    query: z.string(),
    engine: z.string(),
    mode: z.string(),
    results: z.array(SourceSearchResultSchema),
    message: z.string().nullable().optional(),
    createdAt: IsoTimestampSchema,
  })
  .openapi({
    description: desc('source.search_response', '网页搜索响应'),
  });
export type SourceSearchResponse = z.infer<typeof SourceSearchResponseSchema>;

// ---------------------------------------------------------------------------
// Source summary + per-source QA
// ---------------------------------------------------------------------------

/**
 * Live wire uses `generatedAt` (not `createdAt`) — keep Eden/Zod aligned with handlers.
 * `generatedAt: null` means not yet generated (GET empty state; no LLM side effect).
 */
export const SourceSummarySchema = z
  .object({
    sourceId: IdSchema,
    summary: z.string(),
    keyPoints: z.array(z.string()),
    topics: z.array(z.string()),
    wordCount: z.number().int().nonnegative(),
    generatedAt: IsoTimestampSchema.nullable(),
  })
  .openapi({
    description: desc('source.summary', '来源摘要'),
  });
export type SourceSummary = z.infer<typeof SourceSummarySchema>;

export const SourceQARequestSchema = z
  .object({
    question: z.string().min(1),
  })
  .openapi({
    description: desc('source.qa_request', '单来源问答请求'),
    example: { question: '这篇讲了什么？' },
  });

/** Matches POST …/sources/:sid/qa handler body (sourceName + echoed question). */
export const SourceQAResponseSchema = z.object({
  sourceId: IdSchema,
  sourceName: z.string(),
  question: z.string(),
  answer: z.string(),
});
export type SourceQAResponse = z.infer<typeof SourceQAResponseSchema>;

export const ChunkListSchema = z.array(ChunkSchema);
export type ChunkList = z.infer<typeof ChunkListSchema>;

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
