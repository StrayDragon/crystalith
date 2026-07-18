/**
 * Shared API types — camelCase wire (c65).
 *
 * Prefer Eden `treaty<App>` inferred types, then `@crystalith/shared`.
 * This file is a shrinking island of types not yet migrated (see `_PROGRESS.md` P1.4).
 * Research + workspace tool descriptors removed — do not re-add wire DTOs here.
 */

// biome-ignore lint/suspicious/noExplicitAny: dynamic v2 response shapes
export type WorkspaceToolsDiagnostics = Record<string, any>;

export interface CitationContextResponse {
  chunkId: number;
  sourceId: number;
  sourceName?: string;
  text: string;
  // biome-ignore lint/suspicious/noExplicitAny: v2 compat
  beforeChunks?: Array<Record<string, any>>;
  // biome-ignore lint/suspicious/noExplicitAny: v2 compat
  afterChunks?: Array<Record<string, any>>;
  // biome-ignore lint/suspicious/noExplicitAny: v2 compat
  [key: string]: any;
}

export interface SourceTagRead {
  id: number;
  notebookId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface QaMessage {
  role: string;
  content: string;
}

// -----------------------------------------------------------------------
// Source/Extractor types (migrated from api/generated/types.gen.ts) — P1.4 sources next
// -----------------------------------------------------------------------

export type SourceFromUrlMode = 'fetch' | 'link';

export interface ExtractorInfoResponse {
  available: boolean;
  description: string;
  details?: Record<string, unknown> | null;
  displayName?: string;
  type: string;
  enabled: boolean;
  priority?: number;
  requiresApiKey?: boolean;
  requiresService: boolean;
  pluginId?: string;
  errorCode?: string;
  message?: string;
  recoveryHint?: string;
  metadata?: Record<string, unknown>;
}

export interface ExtractorsListResponse {
  notebookId: number;
  policy: {
    mode: string;
    enabledExtractors: string[] | null;
  };
  extractors: ExtractorInfoResponse[];
  defaultExtractor: string;
  fallbackEnabled: boolean;
}

export interface ChunkRead {
  chunkIndex: number;
  endOffset: number | null;
  id: number;
  metadata: Record<string, unknown> | null;
  sourceId: number;
  startOffset: number | null;
  text: string;
  tokenCount: number;
}

export interface NotebookExtractorsPolicy {
  enabledExtractors?: string[];
  mode?: 'custom' | 'inherit_global';
}

export interface PatchNotebookExtractorsPolicyRequest {
  enabledExtractors?: string[] | null;
  mode?: 'custom' | 'inherit_global' | null;
}
