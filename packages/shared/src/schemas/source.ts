// Source schemas — sources, chunks, tags, connector bindings, extractor policy,
// URL fetch, source search/QA/summary. Mirrors v1 `features.sources.api_schemas`.
import { z } from "zod";
import {
  IdSchema,
  IsoTimestampSchema,
  JsonMetadataSchema,
  OptionalTimestampSchema,
} from "./common.js";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const SourceStatusSchema = z.enum(["processing", "ready", "failed"]);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

export const ExtractorPolicyModeSchema = z.enum(["inherit_global", "custom"]);

// ---------------------------------------------------------------------------
// Chunk
// ---------------------------------------------------------------------------

export const ChunkSchema = z.object({
  id: IdSchema,
  chunk_index: z.number().int().nonnegative(),
  text: z.string(),
  start_offset: z.number().int().nullable().optional(),
  end_offset: z.number().int().nullable().optional(),
  metadata: JsonMetadataSchema.nullable().optional(),
});
export type Chunk = z.infer<typeof ChunkSchema>;

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

export const SourceSchema = z.object({
  id: IdSchema,
  notebook_id: IdSchema,
  filename: z.string().min(1).max(512),
  mime_type: z.string().nullable().optional(),
  parser_type: z.string().min(1).max(64),
  metadata: JsonMetadataSchema.nullable().optional(),
  dedup_key: z.string().nullable().optional(),
  status: SourceStatusSchema,
  error_code: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  recovery_hint: z.string().nullable().optional(),
  last_error_at: OptionalTimestampSchema,
  chunk_count: z.number().int().nonnegative().default(0),
  tags: z.array(z.string()).default([]),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type Source = z.infer<typeof SourceSchema>;

export const SourceCreateSchema = z.object({
  filename: z.string().min(1).max(512),
  content: z.string().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  parser_type: z.string().min(1).max(64).default("text"),
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
  notebook_id: IdSchema,
  name: z.string().min(1).max(64),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type SourceTag = z.infer<typeof SourceTagSchema>;

export const SourceTagCreateSchema = z.object({
  name: z.string().min(1).max(64),
});
export type SourceTagCreate = z.infer<typeof SourceTagCreateSchema>;

export const SourceTagBindingRequestSchema = z.object({
  source_ids: z.array(IdSchema).min(1),
});

export const SourceBatchItemResultSchema = z.object({
  source_id: IdSchema,
  ok: z.boolean(),
  error_code: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
});

export const SourceBatchDeleteRequestSchema = z.object({
  source_ids: z.array(IdSchema).min(1),
});

export const SourceBatchDeleteResponseSchema = z.object({
  results: z.array(SourceBatchItemResultSchema).default([]),
  deleted_ids: z.array(IdSchema),
  deleted_count: z.number().int().nonnegative(),
});

export const SourceBatchReembedRequestSchema = z.object({
  source_ids: z.array(IdSchema).min(1),
});

export const SourceBatchReembedResponseSchema = z.object({
  results: z.array(SourceBatchItemResultSchema).default([]),
  reembedded_ids: z.array(IdSchema),
  failed_ids: z.array(IdSchema),
  reembedded_count: z.number().int().nonnegative(),
  failed_count: z.number().int().nonnegative(),
});

// ---------------------------------------------------------------------------
// Source connector bindings
// ---------------------------------------------------------------------------

export const SourceConnectorBindingSchema = z.object({
  id: IdSchema,
  notebook_id: IdSchema,
  connector_id: z.string().min(1).max(128),
  connection_config: JsonMetadataSchema,
  import_scope: JsonMetadataSchema.nullable().optional(),
  last_confirmed_snapshot: JsonMetadataSchema.nullable().optional(),
  last_sync_check_result: JsonMetadataSchema.nullable().optional(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type SourceConnectorBinding = z.infer<typeof SourceConnectorBindingSchema>;

// ---------------------------------------------------------------------------
// Notebook extractor policy
// ---------------------------------------------------------------------------

export const NotebookExtractorPolicySchema = z.object({
  notebook_id: IdSchema,
  mode: ExtractorPolicyModeSchema.default("inherit_global"),
  enabled_extractors: z.array(z.string()).nullable().optional(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type NotebookExtractorPolicy = z.infer<typeof NotebookExtractorPolicySchema>;

export const PatchNotebookExtractorPolicySchema = z.object({
  mode: ExtractorPolicyModeSchema.optional(),
  enabled_extractors: z.array(z.string()).nullable().optional(),
});

// ---------------------------------------------------------------------------
// URL ingestion + web extraction
// ---------------------------------------------------------------------------

export const SourceFromUrlModeSchema = z.enum(["fetch", "link"]);

export const SourceFromUrlRequestSchema = z
  .object({
    url: z.string().url().refine((v) => v.startsWith("http://") || v.startsWith("https://"), {
      message: "url must start with http:// or https://",
    }),
    title: z.string().nullable().optional(),
    snippet: z.string().nullable().optional(),
    mode: SourceFromUrlModeSchema.default("link"),
    extractor: z
      .string()
      .nullable()
      .optional()
      .refine(
        (v) => v === null || v === undefined || ["trafilatura", "jina", "firecrawl", "browserless"].includes(v.toLowerCase()),
        { message: "extractor must be one of: trafilatura, jina, firecrawl, browserless" },
      ),
  })
  .transform((v) => ({
    ...v,
    extractor: v.extractor === null || v.extractor === undefined ? null : v.extractor.toLowerCase(),
  }));
export type SourceFromUrlRequest = z.infer<typeof SourceFromUrlRequestSchema>;

export const ExtractorInfoSchema = z.object({
  type: z.string(),
  plugin_id: z.string().nullable().optional(),
  enabled: z.boolean(),
  available: z.boolean(),
  display_name: z.string(),
  description: z.string(),
  priority: z.number().int(),
  requires_api_key: z.boolean().default(false),
  requires_service: z.boolean().default(false),
  error_code: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  recovery_hint: z.string().nullable().optional(),
  details: JsonMetadataSchema.nullable().optional(),
});

export const ExtractorsListSchema = z.object({
  extractors: z.array(ExtractorInfoSchema),
  default_extractor: z.string().nullable().optional(),
  fallback_enabled: z.boolean().default(true),
  policy: NotebookExtractorPolicySchema,
});

// ---------------------------------------------------------------------------
// Source search (web)
// ---------------------------------------------------------------------------

export const SourceSearchRequestSchema = z.object({
  query: z.string().min(1),
  engine: z.string().default("Web"),
  mode: z.string().default("Fast Research"),
});

export const SourceSearchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

export const SourceSearchStatusSchema = z.enum(["ok", "not_implemented"]);

export const SourceSearchResponseSchema = z.object({
  status: SourceSearchStatusSchema,
  query: z.string(),
  engine: z.string(),
  mode: z.string(),
  results: z.array(SourceSearchResultSchema),
  message: z.string().nullable().optional(),
  created_at: IsoTimestampSchema,
});

// ---------------------------------------------------------------------------
// Source summary + per-source QA
// ---------------------------------------------------------------------------

export const SourceSummarySchema = z.object({
  source_id: IdSchema,
  summary: z.string(),
  key_points: z.array(z.string()),
  topics: z.array(z.string()),
  word_count: z.number().int().nonnegative(),
  generated_at: IsoTimestampSchema,
});

export const SourceQARequestSchema = z.object({
  question: z.string().min(1),
});

export const SourceQAResponseSchema = z.object({
  source_id: IdSchema,
  answer: z.string(),
  created_at: IsoTimestampSchema,
});

export const QAMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const ConvertSourceQAToSourceRequestSchema = z.object({
  messages: z.array(QAMessageSchema).min(1),
});

export const ConvertSourceQAToSourceResponseSchema = z.object({
  source_id: IdSchema,
  filename: z.string(),
});
