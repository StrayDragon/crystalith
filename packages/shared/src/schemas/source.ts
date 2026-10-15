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
      .refine((v) => v === null || v === undefined || /^[a-z][a-z0-9_-]*$/u.test(v.toLowerCase()), {
        message: 'extractor must be a lowercase identifier',
      }),
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

/**
 * Nested POST /v2/notebooks/:nid/sources/upload — path `:nid` is SSOT;
 * optional query notebookId must match when present.
 */
export const SourceUploadNestedQuerySchema = z.object({
  notebookId: z.coerce.number().int().positive().optional(),
  dedupAction: z.enum(['prompt', 'reuse', 'create_new', 'replace']).default('prompt'),
});
export type SourceUploadNestedQuery = z.infer<typeof SourceUploadNestedQuerySchema>;

/**
 * 409 CONFLICT details for a dedup hit (dedupAction='prompt' on upload or
 * from-url). Discriminates the dedup conflict from other CONFLICTs so the
 * client can run the reuse/create_new/replace handshake (c134 r490 / c135
 * r491).
 */
export const SourceDedupHitDetailsSchema = z
  .object({
    /** content = identical bytes hit; filename = same name, different bytes. */
    kind: z
      .enum(['content', 'filename'])
      .describe(desc('source.dedup_hit.kind', '命中类型：content=内容相同；filename=文件名相同')),
    existingSourceId: IdSchema.describe(
      desc('source.dedup_hit.existing_source_id', '命中的既有来源 id'),
    ),
    existingFilename: z
      .string()
      .describe(desc('source.dedup_hit.existing_filename', '既有来源文件名')),
  })
  .openapi({
    description: desc('source.dedup_hit_details', '去重命中（409）的 details 载荷'),
  });
export type SourceDedupHitDetails = z.infer<typeof SourceDedupHitDetailsSchema>;

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
  urlPatterns: z
    .array(z.string())
    .nullable()
    .optional()
    .describe(desc('source.extractor_url_patterns', 'URL 正则源列表，仅用于导入对话框预选提示')),
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

export const SourceSearchStatusSchema = z
  .enum(['ok', 'not_implemented', 'no_results', 'service_error'])
  .openapi({
    description: desc(
      'source.search_status',
      '搜索结果状态：ok=有命中；no_results=引擎正常应答零命中；service_error=引擎不可用或调用失败',
    ),
  });
export type SourceSearchStatus = z.infer<typeof SourceSearchStatusSchema>;

export const SourceSearchResponseSchema = z
  .object({
    status: SourceSearchStatusSchema,
    query: z.string(),
    engine: z.string(),
    mode: z.string(),
    results: z.array(SourceSearchResultSchema),
    message: z
      .string()
      .nullable()
      .optional()
      .openapi({
        description: desc(
          'source.search_message',
          '补充文案；status=service_error 时 MUST 为用户可读中文错误文案',
        ),
      }),
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
  /** c131 r482: set when the answer is a degrade notice (e.g. index rebuilding). */
  degraded: z
    .string()
    .optional()
    .describe(
      desc('source.qa.degraded', '降级原因（如 index_rebuilding 表示索引重建中，回答为提示文案）'),
    ),
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

// ---------------------------------------------------------------------------
// Search index rebuild + status (c131 r480/r481)
// ---------------------------------------------------------------------------

export const SearchIndexRebuildResponseSchema = z
  .object({
    jobId: z
      .number()
      .int()
      .describe(desc('searchIndex.rebuild.jobId', '重建任务 id，用于查询进度')),
    mode: z
      .enum(['notebook', 'global'])
      .describe(
        desc(
          'searchIndex.rebuild.mode',
          '重建模式：notebook 仅该笔记本；global 为维度变更引发的整库重建',
        ),
      ),
  })
  .openapi({ description: desc('searchIndex.rebuild.response', '重建任务启动结果（异步）') });

export const SearchIndexProgressSchema = z
  .object({
    total: z.number().int().describe(desc('searchIndex.progress.total', '待重嵌来源总数')),
    done: z.number().int().describe(desc('searchIndex.progress.done', '已成功来源数')),
    failed: z.number().int().describe(desc('searchIndex.progress.failed', '失败来源数')),
  })
  .openapi({ description: desc('searchIndex.progress', '重建进度计数') });

export const SearchIndexLastJobSchema = z
  .object({
    id: z.number().int().describe(desc('searchIndex.lastJob.id', '最近一次重建任务 id')),
    mode: z
      .enum(['notebook', 'global'])
      .describe(desc('searchIndex.lastJob.mode', '最近一次重建模式')),
    state: z.string().describe(desc('searchIndex.lastJob.state', '最近一次任务状态')),
    total: z.number().int().describe(desc('searchIndex.lastJob.total', '该任务来源总数')),
    done: z.number().int().describe(desc('searchIndex.lastJob.done', '该任务成功数')),
    failed: z.number().int().describe(desc('searchIndex.lastJob.failed', '该任务失败数')),
  })
  .openapi({ description: desc('searchIndex.lastJob', '最近一次重建任务摘要') });

export const SearchIndexStatusSchema = z
  .object({
    state: z
      .enum(['ready', 'rebuilding', 'dim_mismatch', 'interrupted'])
      .describe(
        desc(
          'searchIndex.status.state',
          '索引状态：ready 就绪；rebuilding 重建中；dim_mismatch 维度不匹配；interrupted 上次重建被中断',
        ),
      ),
    declaredDims: z
      .number()
      .int()
      .nullable()
      .optional()
      .describe(
        desc('searchIndex.status.declaredDims', '默认嵌入模型声明维度（dim_mismatch 时给出）'),
      ),
    tableDims: z
      .number()
      .int()
      .nullable()
      .optional()
      .describe(desc('searchIndex.status.tableDims', 'vec_chunks 现表维度（dim_mismatch 时给出）')),
    jobId: z
      .number()
      .int()
      .nullable()
      .optional()
      .describe(desc('searchIndex.status.jobId', '相关任务 id（rebuilding/interrupted 时给出）')),
    progress: SearchIndexProgressSchema.optional().describe(
      desc('searchIndex.status.progress', '重建进度（rebuilding 时给出）'),
    ),
    lastJob: SearchIndexLastJobSchema.optional().describe(
      desc('searchIndex.status.lastJob', '最近一次任务摘要（有历史时给出）'),
    ),
    derivedFailedCount: z
      .number()
      .int()
      .optional()
      .describe(
        desc(
          'searchIndex.status.derivedFailedCount',
          '产出自动索引派生行中嵌入失败的数量（大于 0 时可走重建恢复，c132）',
        ),
      ),
  })
  .openapi({ description: desc('searchIndex.status', '笔记本嵌入索引状态') });

export type SearchIndexRebuildResponse = z.infer<typeof SearchIndexRebuildResponseSchema>;
export type SearchIndexProgress = z.infer<typeof SearchIndexProgressSchema>;
export type SearchIndexLastJob = z.infer<typeof SearchIndexLastJobSchema>;
export type SearchIndexStatus = z.infer<typeof SearchIndexStatusSchema>;
