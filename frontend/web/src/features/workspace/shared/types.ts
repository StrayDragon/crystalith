export type PanelId = 'sources' | 'chat' | 'refine';
export type ConnectionState = 'connecting' | 'error' | 'live';
export type RefineMode = 'paragraph' | 'bullets' | 'structured';
export type RefineStatus = 'queued' | 'running' | 'done' | 'error';
export type GenerationPreference = 'quality' | 'speed';
export type GenerationPreferenceSetting = GenerationPreference | 'default';
export type OutputTypeId =
  | 'FAQ'
  | 'GUIDE'
  | 'TIMELINE'
  | 'MINDMAP'
  | 'QUIZ'
  | 'BRIEFING'
  | 'SLIDES'
  | 'PARAGRAPH'
  | 'BULLETS'
  | 'STRUCTURED';

export interface OutputContentBase {
  title?: string | null;
  _fallback?: boolean;
  _warnings?: string[];
}

export interface FAQOutputContent extends OutputContentBase {
  items: Array<{ question?: string | null; answer?: string | null }>;
}

export interface GuideOutputContent extends OutputContentBase {
  modules: Array<{
    title?: string | null;
    objective?: { text?: string | null } | null;
    key_points?: Array<{ text?: string | null }> | null;
  }>;
}

export interface TimelineOutputContent extends OutputContentBase {
  events: Array<{ date?: string | null; event?: string | null; description?: string | null }>;
}

export interface MindmapOutputNode {
  label?: string | null;
  children?: MindmapOutputNode[] | null;
}

export interface MindmapOutputContent extends OutputContentBase {
  root: MindmapOutputNode;
}

export interface QuizOutputContent extends OutputContentBase {
  questions: Array<{
    question?: string | null;
    options?: string[] | null;
    answer?: string | string[] | null;
    explanation?: string | null;
  }>;
}

export interface BriefingOutputContent extends OutputContentBase {
  sections: Array<{
    heading?: string | null;
    points?: Array<{ text?: string | null }> | null;
  }>;
}

export interface SlidesOutputContent extends OutputContentBase {
  slide_id?: number | null;
  engine?: string | null;
  outline?: {
    title?: string | null;
    slides?: Array<{ title?: string | null; bullets?: string[] | null }> | null;
  } | null;
  markdown?: string | null;
}

export interface ParagraphOutputContent extends OutputContentBase {
  text: string;
}

export interface BulletsOutputContent extends OutputContentBase {
  items: Array<string | { text?: string | null }>;
}

export interface StructuredOutputContent extends OutputContentBase {
  bullets?: Array<string | { text?: string | null }> | null;
  terms?: string[] | null;
}

export type OutputContentByType = {
  FAQ: FAQOutputContent;
  GUIDE: GuideOutputContent;
  TIMELINE: TimelineOutputContent;
  MINDMAP: MindmapOutputContent;
  QUIZ: QuizOutputContent;
  BRIEFING: BriefingOutputContent;
  SLIDES: SlidesOutputContent;
  PARAGRAPH: ParagraphOutputContent;
  BULLETS: BulletsOutputContent;
  STRUCTURED: StructuredOutputContent;
};

export type KnownOutputPayload = OutputContentByType[OutputTypeId];
export type UnknownOutputPayload = OutputContentBase & Record<string, unknown>;
export type OutputPayload = KnownOutputPayload | UnknownOutputPayload;
export type SlideStage = 'input' | 'outline' | 'markdown';
export type SlideStatus = 'idle' | 'running' | 'error';
export type SourceSearchStatus = 'ok' | 'not_implemented';
export type ToolTone = 'slate' | 'blue' | 'green' | 'rose' | 'amber' | 'teal' | 'indigo';

export type RenderLayout = 'list' | 'cards' | 'tree' | 'timeline' | 'sections' | 'table';
export type RenderFieldType =
  | 'text'
  | 'heading'
  | 'badge'
  | 'list'
  | 'tree'
  | 'date'
  | 'citation'
  | 'code';

export interface FieldDescriptor {
  key: string;
  type: RenderFieldType;
  label: string | null;
  children: FieldDescriptor[];
}

export interface ItemSchema {
  fields: FieldDescriptor[];
}

export interface RenderDescriptor {
  layout: RenderLayout;
  item_schema: ItemSchema | null;
  options: Record<string, unknown>;
}

export interface ConfigOption {
  id: string;
  label: string;
  is_default?: boolean;
}

export interface PluginConfigSchema {
  quantity_options: ConfigOption[];
  difficulty_options: ConfigOption[];
  topic_placeholder: string;
  supports_topic: boolean;
}

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
  indexProgress?: number | null;
  chunks: number;
  tags: string[];
  createdAt: string;
  createdAtRaw?: string;
}

export interface Citation {
  id: string;
  chunkId: number | null;
  sourceId?: number | null;
  sourceTitle: string;
  snippet: string;
  chunkIndex: number;
  pageNumber?: number | null;
  paragraphIndex?: number | null;
  score?: number;
}

export type CitationScopeMode = 'selected' | 'auto';

export interface CitationScopeSnapshot {
  mode: CitationScopeMode;
  kind: 'citations' | 'sources';
  count: number;
  sources: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citationChunkIds?: number[];
  citations?: Citation[];
  citationScope?: CitationScopeSnapshot;
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
  renderDescriptor?: RenderDescriptor | null;
  configSchema?: PluginConfigSchema | null;
}

export interface SlideOutlineItem {
  title: string;
  bullets: string[];
}

export interface SlideOutline {
  title: string;
  slides: SlideOutlineItem[];
}

export interface SlideGenerationConfig {
  preference?: GenerationPreference | null;
  quantity?: string | null;
  audience?: string | null;
  structure?: string | null;
  tone?: string | null;
  language?: string | null;
  density?: string | null;
  themePreset?: string | null;
  frontmatter?: string | null;
}

export interface SlideDraft {
  id: number;
  notebookId: number;
  outputId?: number | null;
  title?: string | null;
  prompt?: string | null;
  engine: string;
  chunkIds?: number[] | null;
  sourceIds?: number[] | null;
  outline?: SlideOutline | null;
  markdown?: string | null;
  generationConfig?: SlideGenerationConfig | null;
  stage: SlideStage;
  status: SlideStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
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
  sourceIds?: number[];
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

export interface OutputItem {
  id: number;
  type: OutputTypeId;
  prompt: string;
  chunkIds: number[];
  content: OutputPayload;
  createdAt: string;
  updatedAt: string;
  createdAtRaw?: string;
  updatedAtRaw?: string;
}

export type TypedOutputItem = {
  [K in OutputTypeId]: Omit<OutputItem, 'type' | 'content'> & {
    type: K;
    content: OutputContentByType[K];
  };
}[OutputTypeId];

export interface StatusLabel {
  text: string;
  tone: 'isLoading' | 'isError' | 'isLive';
  tooltip: string;
}

export interface ErrorsState {
  notebooks: string;
  sources: string;
  sessions: string;
  messages: string;
  outputs: string;
  send: string;
  create: string;
}

export interface LoadingState {
  notebooks: boolean;
  sources: boolean;
  sessions: boolean;
  messages: boolean;
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

export interface ApiWorkspaceTool {
  id: string;
  label: string;
  description: string;
  tone: ToolTone;
  output_type: OutputTypeId;
  prompt: string;
  render_descriptor?: RenderDescriptor | null;
  config_schema?: PluginConfigSchema | null;
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
  metadata?: Record<string, unknown> | null;
  tags?: string[] | null;
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
