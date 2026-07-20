/**
 * Workspace **UI-domain** types (view models, panel state, render descriptors).
 *
 * Wire/API shapes live in `@crystalith/shared` (Zod SSOT) and reach the client
 * via Eden `treaty<App>`. Do not reintroduce `Api*` DTOs here — normalize in
 * `utils.ts` from shared/Eden types into these UI shapes.
 */
import type { OutputContentBase, OutputContentByType } from '@crystalith/shared';

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

/** Content shapes — SSOT in `@crystalith/shared` (Zod + inferred types). */
export type {
  OutputContentBase,
  OutputContentByType,
  FAQOutputContent,
  GuideOutputContent,
  TimelineOutputContent,
  MindmapOutputNode,
  MindmapOutputContent,
  QuizOutputContent,
  BriefingOutputContent,
  SlidesOutputContent,
  ParagraphOutputContent,
  BulletsOutputContent,
  StructuredOutputContent,
} from '@crystalith/shared';

export type KnownOutputPayload = OutputContentByType[OutputTypeId];
export type UnknownOutputPayload = OutputContentBase & Record<string, unknown>;
export type OutputPayload = KnownOutputPayload | UnknownOutputPayload;
export type SlideStage = 'input' | 'outline' | 'markdown';
export type SlideStatus = 'idle' | 'running' | 'error';
export type ToolTone = 'slate' | 'blue' | 'green' | 'rose' | 'amber' | 'teal' | 'indigo';

/** Wire/render types — SSOT in `@crystalith/shared`. */
export type {
  ConfigOption,
  FieldDescriptor,
  FrontendBundleDescriptor,
  ItemSchema,
  PreviewDescriptor,
  RenderDescriptor,
  RenderFieldType,
  RenderLayout,
  ThemePresetOption,
  PluginConfig as PluginConfigSchema,
} from '@crystalith/shared';

export type PreviewKind = 'external_url';

export interface Notebook {
  id: number;
  title: string;
  updatedAt: string;
  updatedAtRaw?: string;
}

export interface SourceItem {
  id: number;
  title: string;
  type: string;
  status: string;
  statusTone: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  recoveryHint?: string | null;
  lastErrorAt?: string | null;
  indexProgress?: number | null;
  chunks: number;
  tags: string[];
  createdAt: string;
  createdAtRaw?: string;
}

/**
 * UI-domain citation (camelCase, aligned with packages/shared CitationSchema).
 * `normalizeCitation` only adds UI `id` and fills defaults — no snake_case remap.
 */
export interface Citation {
  id: string;
  chunkId: number | null;
  sourceId?: number | null;
  sourceName: string;
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
  renderDescriptor?: import('@crystalith/shared').RenderDescriptor | null;
  configSchema?: import('@crystalith/shared').PluginConfig | null;
  frontendBundle?: import('@crystalith/shared').FrontendBundleDescriptor | null;
}

/** GET /v2/workspace/tools `diagnostics` — UI-only view of Eden payload (not a wire SSOT). */
export type WorkspaceToolsDiagnostics = {
  plugins?: {
    loaded?: string[];
    skipped?: Record<string, unknown>;
  };
  official?: Record<
    string,
    {
      hint?: string | null;
      status?: string;
      message?: string | null;
      errorCode?: string | null;
      [key: string]: unknown;
    }
  >;
  slides?: {
    available?: boolean;
    message?: string | null;
    hint?: string | null;
    activePluginId?: string | null;
    engine?: string | null;
    errorCode?: string | null;
    [key: string]: unknown;
  } | null;
} | null;

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
  /** Full payload when loaded; null for list-only rows (c72). */
  content: OutputPayload | null;
  /** True after detail GET or generate response with body (c72). */
  contentLoaded: boolean;
  /** Server-derived list title (c72). */
  title?: string | null;
  preview?: string | null;
  /** SLIDES draft id from list projection (c72). */
  slideId?: number | null;
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
