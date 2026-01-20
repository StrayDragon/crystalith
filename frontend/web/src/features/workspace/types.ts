export type PanelId = 'sources' | 'chat' | 'refine';
export type ConnectionState = 'connecting' | 'demo' | 'live';
export type RefineMode = 'paragraph' | 'bullets' | 'structured';
export type RefineStatus = 'queued' | 'running' | 'done' | 'error';
export type OutputTypeId =
  | 'FAQ'
  | 'GUIDE'
  | 'TIMELINE'
  | 'MINDMAP'
  | 'QUIZ'
  | 'BRIEFING'
  | 'PARAGRAPH'
  | 'BULLETS'
  | 'STRUCTURED';
export type SuggestionType = 'factual' | 'analytical' | 'comparative' | 'creative' | 'deep_dive';
export type SourceSearchStatus = 'ok' | 'not_implemented';
export type ToolTone = 'slate' | 'blue' | 'green' | 'rose' | 'amber' | 'teal' | 'indigo';

export interface Notebook {
  id: number;
  title: string;
  updatedAt: string;
}

export interface SourceItem {
  id: number;
  title: string;
  type: string;
  status: string;
  statusTone: string;
  chunks: number;
}

export interface Citation {
  id: string;
  chunkId: number | null;
  sourceTitle: string;
  snippet: string;
  chunkIndex: number;
  pageNumber?: number | null;
  paragraphIndex?: number | null;
  score?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citationChunkIds?: number[];
  citations?: Citation[];
}

export interface WorkspaceTool {
  id: string;
  label: string;
  description: string;
  tone: ToolTone;
  outputType: OutputTypeId;
  prompt: string;
  badge?: string;
  enabled: boolean;
}

export interface RefineOutputStructured {
  title?: string;
  bullets?: string[];
  terms?: string[];
}

export interface RefineOutput {
  paragraph: string;
  bullets: string[];
  structured: RefineOutputStructured | null;
  evidence?: boolean;
}

export interface RefineJob {
  id: string;
  prompt: string;
  status: RefineStatus;
  chunkIds?: number[];
  outputs: Partial<Record<RefineMode, RefineOutput>> | null;
  error: string;
  citations?: Citation[];
  createdAt: string;
  createdAtLabel: string;
  completedAt: string | null;
  completedAtLabel: string;
  pinned: boolean;
  title: string;
  notebookId: number | null;
}

export interface RefineTemplate {
  id: string;
  label: string;
  prompt: string;
  group?: string;
}

export interface RefineSettings {
  autoTrigger: boolean;
  asyncQueue: boolean;
}

export interface SessionSummary {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestionItem {
  question: string;
  type: SuggestionType;
  context: string;
}

export interface OutputItem {
  id: number;
  type: OutputTypeId;
  prompt: string;
  chunkIds: number[];
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdAtRaw?: string;
  updatedAtRaw?: string;
}

export interface StatusLabel {
  text: string;
  tone: 'isLoading' | 'isDemo' | 'isLive';
  tooltip: string;
}

export interface ErrorsState {
  notebooks: string;
  sources: string;
  sessions: string;
  messages: string;
  suggestions: string;
  outputs: string;
  send: string;
  create: string;
}

export interface LoadingState {
  notebooks: boolean;
  sources: boolean;
  sessions: boolean;
  messages: boolean;
  suggestions: boolean;
  outputs: boolean;
  send: boolean;
}

export interface ApiNotebook {
  id: number;
  name?: string | null;
  updated_at?: string | null;
}

export interface ApiSession {
  id: number;
  notebook_id: number;
  title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ApiMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: ApiCitation[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ApiSuggestion {
  question: string;
  type: SuggestionType;
  context: string;
}

export interface ApiSuggestionResponse {
  suggestions: ApiSuggestion[];
  created_at?: string | null;
}

export interface ApiWorkspaceTool {
  id: string;
  label: string;
  description: string;
  tone: ToolTone;
  output_type: OutputTypeId;
  prompt: string;
  badge?: string | null;
  enabled?: boolean | null;
}

export interface ApiWorkspaceToolsResponse {
  tools: ApiWorkspaceTool[];
}

export interface ApiOutput {
  id: number;
  notebook_id: number;
  type: OutputTypeId;
  prompt?: string | null;
  chunk_ids?: number[] | null;
  content: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ApiSource {
  id: number;
  notebook_id?: number | null;
  filename?: string | null;
  mime_type?: string | null;
  status?: string | null;
  chunk_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ApiSourceDeleteResponse {
  deleted_ids: number[];
  deleted_count: number;
}

export interface ApiSourceSearchResult {
  title: string;
  url: string;
  snippet?: string | null;
  source?: string | null;
}

export interface ApiSourceSearchResponse {
  status: SourceSearchStatus;
  query: string;
  engine: string;
  mode: string;
  results: ApiSourceSearchResult[];
  message?: string | null;
  created_at?: string | null;
}

export interface ApiCitation {
  source_id?: number | null;
  source_name?: string | null;
  chunk_id?: number | string | null;
  chunk_index?: number | null;
  page_number?: number | null;
  paragraph_index?: number | null;
  snippet?: string | null;
  score?: number | null;
}

export interface ApiAnswer {
  answer: string;
  citations?: ApiCitation[];
  evidence?: boolean;
  confidence?: number;
  created_at?: string | null;
}

export interface ApiRefineOutput {
  paragraph?: string | null;
  bullets?: string[] | null;
  structured?: RefineOutputStructured | null;
}

export interface ApiRefineBatchResponse {
  outputs?: Partial<Record<RefineMode, ApiRefineOutput>>;
  evidence?: boolean;
  citations?: ApiCitation[];
}
