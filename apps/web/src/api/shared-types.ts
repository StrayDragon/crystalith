/**
 * Shared API types — camelCase wire (c65).
 *
 * Prefer Eden `treaty<App>` inferred types, then `@crystalith/shared`.
 * This file is a shrinking island of types not yet migrated (see `_PROGRESS.md` P1.4).
 */

import type { ResearchStatus } from '@crystalith/shared';

export type { ResearchStatus };

export interface ResearchSessionListItem {
  id: number;
  notebookId: number;
  topic: string;
  status: ResearchStatus;
  currentIteration: number;
  maxIterations: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchStepResponse {
  id: number;
  type: string;
  iteration: number;
  inputData: Record<string, unknown> | null;
  outputData: Record<string, unknown> | null;
  status: string;
  createdAt: string;
}

export interface ResearchSessionResponse {
  id: number;
  notebookId: number;
  topic: string;
  status: ResearchStatus;
  currentIteration: number;
  maxIterations: number;
  aggregatedResults: Array<Record<string, unknown>> | null;
  finalReport: string | null;
  createdAt: string;
  updatedAt: string;
  steps?: ResearchStepResponse[];
}

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

export type Citation = {
  chunkId: number;
  sourceId: number;
  sourceName?: string;
  text?: string;
  score?: number;
  pageNumber?: number | null;
  paragraphIndex?: number | null;
  chunkIndex?: number;
  snippet?: string;
  // biome-ignore lint/suspicious/noExplicitAny: v2 compat
  [key: string]: any;
};

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

export type OutputTypeInput = 'PARAGRAPH' | 'BULLETS' | 'STRUCTURED' | 'SLIDES';

export interface TaskRead {
  id: number;
  type: string;
  status: string;
  title: string;
  notebookId: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

// -----------------------------------------------------------------------
// Source/Extractor types (migrated from api/generated/types.gen.ts)
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

export interface FieldDescriptor {
  key: string;
  type: string;
  label: string | null;
  options?: Record<string, unknown>;
  children?: FieldDescriptor[];
}

export interface RenderDescriptor {
  layout: string;
  itemSchema: { fields: FieldDescriptor[] } | null;
  options: Record<string, unknown>;
}

export interface PreviewDescriptor {
  type: string;
  url?: string;
  label?: string;
  requires?: string[];
}

export interface FrontendBundleDescriptor {
  apiVersion: string;
  kind: string;
  id: string;
  export: string;
}

export interface PluginConfigSchema {
  description?: string;
  preview?: PreviewDescriptor | null;
  frontendBundle?: FrontendBundleDescriptor | null;
  [key: string]: unknown;
}

export interface WorkspaceTool {
  id: string;
  kind: string;
  label: string;
  description: string;
  tone?: string;
  outputType: string;
  prompt: string;
  isTool: boolean;
  enabled: boolean;
  configSchema?: PluginConfigSchema | null;
  renderDescriptor?: RenderDescriptor | null;
  frontendBundle?: FrontendBundleDescriptor | null;
}
