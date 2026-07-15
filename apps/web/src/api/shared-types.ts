/**
 * Re-exported types from the generated client, now defined locally
 * as generic Record alias for the eden treaty migration.
 * These match the v2 server response shapes (analysis, research, etc.).
 *
 * Using Record<string, unknown> for complex types to avoid drift
 * with the actual server responses. Components should use type
 * assertions as needed.
 */

// biome-ignore lint/suspicious/noExplicitAny: dynamic v2 response shapes
export type AnalysisResult = Record<string, any>;

// biome-ignore lint/suspicious/noExplicitAny: dynamic v2 response shapes
export type Topic = Record<string, any>;

// biome-ignore lint/suspicious/noExplicitAny: dynamic v2 response shapes
export type Relation = Record<string, any>;

export type ResearchStatus =
  | 'planning'
  | 'searching'
  | 'analyzing'
  | 'waiting_user'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface ResearchSessionListItem {
  id: number;
  notebook_id: number;
  topic: string;
  status: ResearchStatus;
  current_iteration: number;
  max_iterations: number;
  created_at: string;
  updated_at: string;
}

export interface ResearchStepResponse {
  id: number;
  type: string;
  iteration: number;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

export interface ResearchSessionResponse {
  id: number;
  notebook_id: number;
  topic: string;
  status: ResearchStatus;
  current_iteration: number;
  max_iterations: number;
  aggregated_results: Array<Record<string, unknown>> | null;
  final_report: string | null;
  created_at: string;
  updated_at: string;
  steps?: ResearchStepResponse[];
}

// biome-ignore lint/suspicious/noExplicitAny: dynamic v2 response shapes
export type WorkspaceToolsDiagnostics = Record<string, any>;

export interface CitationContextResponse {
  chunk_id: number;
  source_id: number;
  source_title?: string;
  text: string;
  // v2 server response may differ from v1 shape — accept any
  // biome-ignore lint/suspicious/noExplicitAny: v2 compat
  before_chunks?: Array<Record<string, any>>;
  // biome-ignore lint/suspicious/noExplicitAny: v2 compat
  after_chunks?: Array<Record<string, any>>;
  // biome-ignore lint/suspicious/noExplicitAny: v2 compat
  [key: string]: any;
}

export type Citation = {
  chunk_id: number;
  source_id: number;
  source_title?: string;
  text?: string;
  score?: number;
  page_number?: number | null;
  paragraph_index?: number | null;
  chunk_index?: number;
  snippet?: string;
  // biome-ignore lint/suspicious/noExplicitAny: v2 compat
  [key: string]: any;
};

export interface SourceTagRead {
  id: number;
  notebook_id: number;
  name: string;
  created_at: string;
  updated_at: string;
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
  notebook_id: number;
  created_at: string;
  updated_at: string;
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
  type: string;
  enabled: boolean;
  requires_service: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChunkRead {
  chunk_index: number;
  end_offset: number | null;
  id: number;
  metadata: Record<string, unknown> | null;
  source_id: number;
  start_offset: number | null;
  text: string;
  token_count: number;
}

export interface NotebookExtractorsPolicy {
  enabled_extractors?: string[];
  mode?: 'custom' | 'inherit_global';
}

export interface PatchNotebookExtractorsPolicyRequest {
  enabled_extractors?: string[] | null;
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
  item_schema: { fields: FieldDescriptor[] } | null;
  options: Record<string, unknown>;
}

export interface PreviewDescriptor {
  type: string;
  url?: string;
  label?: string;
  requires?: string[];
}

export interface FrontendBundleDescriptor {
  api_version: string;
  kind: string;
  id: string;
  export: string;
}

export interface PluginConfigSchema {
  description?: string;
  preview?: PreviewDescriptor | null;
  frontend_bundle?: FrontendBundleDescriptor | null;
  [key: string]: unknown;
}

export interface WorkspaceTool {
  id: string;
  kind: string;
  label: string;
  description: string;
  tone?: string;
  output_type: string;
  prompt: string;
  is_tool: boolean;
  enabled: boolean;
  config_schema?: PluginConfigSchema | null;
  render_descriptor?: RenderDescriptor | null;
  frontend_bundle?: FrontendBundleDescriptor | null;
}
