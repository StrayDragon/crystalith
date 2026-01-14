export type PanelId = 'sources' | 'chat' | 'refine';
export type ConnectionState = 'connecting' | 'demo' | 'live';
export type RefineMode = 'paragraph' | 'bullets' | 'structured';
export type RefineStatus = 'queued' | 'running' | 'done' | 'error';

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
  score?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citationChunkIds?: number[];
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

export interface StatusLabel {
  text: string;
  tone: 'isLoading' | 'isDemo' | 'isLive';
  tooltip: string;
}

export interface ErrorsState {
  notebooks: string;
  sources: string;
  send: string;
  create: string;
}

export interface LoadingState {
  notebooks: boolean;
  sources: boolean;
  send: boolean;
}

export interface ApiNotebook {
  id: number;
  name?: string | null;
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

export interface ApiCitation {
  source_id?: number | null;
  source_name?: string | null;
  chunk_id?: number | string | null;
  chunk_index?: number | null;
  snippet?: string | null;
  score?: number | null;
}

export interface ApiAnswer {
  answer: string;
  citations?: ApiCitation[];
  evidence?: boolean;
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
