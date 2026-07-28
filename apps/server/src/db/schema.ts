import type {
  ImportScope,
  JsonMetadata,
  SlideGenerationConfig,
  SlidesOutline,
  Snapshot,
  SyncCheckResult,
} from '@crystalith/shared';
// Drizzle ORM schema for Crystalith v2 — single SQLite database.
//
// Maps the business tables 1:1 (incl. strategy_configs for RAG). The sqlite-vec
// `vec_chunks` virtual table is NOT managed by Drizzle (see `vectors.ts`) —
// only relational tables live here.
//
// Conventions:
// - timestamps are integer Unix-ms columns (`mode: 'timestamp'`) rendered to
//   ISO strings on the API boundary.
// - JSON columns use `text({ mode: 'json' })` + `$type<T>()` for type-safe
//   round-tripping (see `json()` helper below).
// - enum-like text columns use `.notNull()` + a default matching the v1
//   server_default.
import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Column helpers
// ---------------------------------------------------------------------------

/** Nullable JSON column. */
const json = <T = JsonMetadata>(name: string) => text(name, { mode: 'json' }).$type<T>();

/** Non-null JSON column. */
const jsonReq = <T = JsonMetadata>(name: string) =>
  text(name, { mode: 'json' }).$type<T>().notNull();

const ts = (name: string) =>
  integer(name, { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date());

const tsUpd = (name: string) =>
  integer(name, { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

const tsNull = (name: string) => integer(name, { mode: 'timestamp' });

const bool = (name: string, def: boolean) =>
  integer(name, { mode: 'boolean' }).notNull().default(def);

// ---------------------------------------------------------------------------
// Notebooks
// ---------------------------------------------------------------------------

export const notebooks = sqliteTable(
  'notebooks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [index('ix_notebooks_name').on(t.name)],
);

export const notebookRelations = relations(notebooks, ({ many }) => ({
  sources: many(sources),
  sourceTags: many(sourceTags),
  sessions: many(sessions),
  outputs: many(outputs),
  sourceConnectorBindings: many(sourceConnectorBindings),
  extractorPolicy: many(notebookExtractorPolicies),
  studioSlides: many(studioSlides),
  strategyConfigs: many(strategyConfigs),
  researchRuns: many(researchRuns),
}));

// ---------------------------------------------------------------------------
// Notebook extractor policies (1:1 with notebook via PK)
// ---------------------------------------------------------------------------

export const notebookExtractorPolicies = sqliteTable('notebook_extractor_policies', {
  notebookId: integer('notebook_id')
    .primaryKey()
    .references(() => notebooks.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull().default('inherit_global'),
  enabledExtractors: text('enabled_extractors', { mode: 'json' }).$type<string[] | null>(),
  createdAt: ts('created_at'),
  updatedAt: tsUpd('updated_at'),
});

// ---------------------------------------------------------------------------
// RAG strategy configs (per-notebook enabled strategy IDs)
// ---------------------------------------------------------------------------

/** Persisted enabled RAG strategies per notebook (was ad-hoc in rag/registry). */
export const strategyConfigs = sqliteTable(
  'strategy_configs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id').notNull(),
    strategyId: text('strategy_id').notNull(),
  },
  (t) => [index('ix_strategy_configs_notebook_id').on(t.notebookId)],
);

export const strategyConfigRelations = relations(strategyConfigs, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [strategyConfigs.notebookId],
    references: [notebooks.id],
  }),
}));

// ---------------------------------------------------------------------------
// Templates + Prompt presets
// ---------------------------------------------------------------------------

export const templates = sqliteTable(
  'templates',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description'),
    configJson: jsonReq('config_json'),
    isBuiltin: bool('is_builtin', false),
    createdAt: ts('created_at'),
  },
  (t) => [index('ix_templates_is_builtin').on(t.isBuiltin)],
);

export const promptPresets = sqliteTable(
  'prompt_presets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    trigger: text('trigger').notNull().unique(),
    description: text('description'),
    systemPrompt: text('system_prompt').notNull(),
    enabled: bool('enabled', true),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [
    index('ix_prompt_presets_enabled').on(t.enabled),
    index('ix_prompt_presets_trigger').on(t.trigger),
  ],
);

// ---------------------------------------------------------------------------
// Sessions + Messages
// ---------------------------------------------------------------------------

export const sessions = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    title: text('title'),
    sharedState: jsonReq('shared_state').default(sql`'{}'`),
    sharedStateRevision: integer('shared_state_revision').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [index('ix_sessions_notebook_id_updated_at').on(t.notebookId, t.updatedAt)],
);

export const sessionRelations = relations(sessions, ({ one, many }) => ({
  notebook: one(notebooks, { fields: [sessions.notebookId], references: [notebooks.id] }),
  messages: many(messages),
}));

export const messages = sqliteTable(
  'messages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull(),
    citations: text('citations', { mode: 'json' }).$type<unknown[] | null>(),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [index('ix_messages_session_id_created_at').on(t.sessionId, t.createdAt)],
);

export const messageRelations = relations(messages, ({ one }) => ({
  session: one(sessions, { fields: [messages.sessionId], references: [sessions.id] }),
}));

// ---------------------------------------------------------------------------
// Sources + Chunks + Tags
// ---------------------------------------------------------------------------

export const sources = sqliteTable(
  'sources',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    mimeType: text('mime_type'),
    parserType: text('parser_type').notNull().default('text'),
    metadata: json<JsonMetadata | null>('metadata'),
    dedupKey: text('dedup_key'),
    status: text('status', { enum: ['processing', 'ready', 'failed'] })
      .notNull()
      .default('processing'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    recoveryHint: text('recovery_hint'),
    lastErrorAt: tsNull('last_error_at'),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [
    index('ix_sources_notebook_id_status').on(t.notebookId, t.status),
    index('ix_sources_notebook_id_dedup_key').on(t.notebookId, t.dedupKey),
  ],
);

export const sourceRelations = relations(sources, ({ one, many }) => ({
  notebook: one(notebooks, { fields: [sources.notebookId], references: [notebooks.id] }),
  chunks: many(chunks),
  tagLinks: many(sourceTagMap),
}));

export const chunks = sqliteTable(
  'chunks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    text: text('text').notNull(),
    startOffset: integer('start_offset'),
    endOffset: integer('end_offset'),
    metadata: json<JsonMetadata | null>('metadata'),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [
    uniqueIndex('uq_chunks_source_id_chunk_index').on(t.sourceId, t.chunkIndex),
    index('ix_chunks_source_id_chunk_index').on(t.sourceId, t.chunkIndex),
  ],
);

export const chunkRelations = relations(chunks, ({ one }) => ({
  source: one(sources, { fields: [chunks.sourceId], references: [sources.id] }),
}));

export const sourceTags = sqliteTable(
  'source_tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [
    uniqueIndex('uq_source_tags_notebook_id_name').on(t.notebookId, t.name),
    index('ix_source_tags_notebook_id_name').on(t.notebookId, t.name),
  ],
);

export const sourceTagRelations = relations(sourceTags, ({ one, many }) => ({
  notebook: one(notebooks, { fields: [sourceTags.notebookId], references: [notebooks.id] }),
  sourceLinks: many(sourceTagMap),
}));

export const sourceTagMap = sqliteTable(
  'source_tag_map',
  {
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => sourceTags.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at'),
  },
  (t) => [
    primaryKey({ columns: [t.sourceId, t.tagId] }),
    index('ix_source_tag_map_tag_id').on(t.tagId),
  ],
);

export const sourceTagMapRelations = relations(sourceTagMap, ({ one }) => ({
  source: one(sources, { fields: [sourceTagMap.sourceId], references: [sources.id] }),
  tag: one(sourceTags, { fields: [sourceTagMap.tagId], references: [sourceTags.id] }),
}));

// ---------------------------------------------------------------------------
// Source connector bindings
// ---------------------------------------------------------------------------

export const sourceConnectorBindings = sqliteTable(
  'source_connector_bindings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    connectorId: text('connector_id').notNull(),
    connectionConfig: jsonReq<Record<string, unknown>>('connection_config'),
    importScope: json<ImportScope | null>('import_scope'),
    lastConfirmedSnapshot: json<Snapshot | null>('last_confirmed_snapshot'),
    lastSyncCheckResult: json<SyncCheckResult | null>('last_sync_check_result'),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [
    index('ix_source_connector_bindings_notebook_id_connector_id').on(t.notebookId, t.connectorId),
  ],
);

export const sourceConnectorBindingRelations = relations(sourceConnectorBindings, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [sourceConnectorBindings.notebookId],
    references: [notebooks.id],
  }),
}));

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export const outputs = sqliteTable(
  'outputs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: [
        'FAQ',
        'GUIDE',
        'TIMELINE',
        'MINDMAP',
        'QUIZ',
        'BRIEFING',
        'SLIDES',
        'PARAGRAPH',
        'BULLETS',
        'STRUCTURED',
      ],
    }).notNull(),
    prompt: text('prompt'),
    chunkIds: text('chunk_ids', { mode: 'json' }).$type<number[] | null>(),
    content: jsonReq('content'),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [index('ix_outputs_notebook_id_created_at').on(t.notebookId, t.createdAt)],
);

export const outputRelations = relations(outputs, ({ one, many }) => ({
  notebook: one(notebooks, { fields: [outputs.notebookId], references: [notebooks.id] }),
  slides: many(studioSlides),
}));

// ---------------------------------------------------------------------------
// Studio slides
// ---------------------------------------------------------------------------

export const studioSlides = sqliteTable(
  'studio_slides',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    outputId: integer('output_id').references(() => outputs.id, { onDelete: 'set null' }),
    title: text('title'),
    prompt: text('prompt'),
    engine: text('engine').notNull().default('slidev'),
    chunkIds: text('chunk_ids', { mode: 'json' }).$type<number[] | null>(),
    sourceIds: text('source_ids', { mode: 'json' }).$type<number[] | null>(),
    outline: json<SlidesOutline | null>('outline'),
    markdown: text('markdown'),
    generationConfig: json<SlideGenerationConfig | null>('generation_config'),
    stage: text('stage', { enum: ['input', 'outline', 'markdown'] })
      .notNull()
      .default('input'),
    status: text('status', { enum: ['idle', 'running', 'error'] })
      .notNull()
      .default('idle'),
    errorMessage: text('error_message'),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [index('ix_studio_slides_notebook_id_updated_at').on(t.notebookId, t.updatedAt)],
);

export const studioSlideRelations = relations(studioSlides, ({ one }) => ({
  notebook: one(notebooks, { fields: [studioSlides.notebookId], references: [notebooks.id] }),
  output: one(outputs, { fields: [studioSlides.outputId], references: [outputs.id] }),
}));

// ---------------------------------------------------------------------------
// Research runs + evidences (c76)
// ---------------------------------------------------------------------------

/** Graph JSON stored on research_runs. */
export type ResearchGraphJson = {
  nodes: Array<{
    id: string;
    title: string;
    role?: 'question' | 'research' | 'conclusion';
    query?: string;
    summary?: string;
    conclusionStatus: 'clear' | 'partial' | 'missing' | 'pending' | 'pruned';
    phase?: 'idle' | 'retrieving' | 'synthesizing';
    evidenceIds?: string[];
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    kind:
      | 'decompose'
      | 'expand'
      | 'focus'
      | 'filter'
      | 'compare'
      | 'refine'
      | 'support'
      | 'fork'
      | 'merge';
    labelNote?: string;
  }>;
};

/** Checkpoint blob (CP1). */
export type ResearchCheckpointJson = {
  at: string;
  status: string;
  searchesUsed: number;
  nodeCount: number;
  reason?: string;
};

/** Report JSON on research_runs. */
export type ResearchReportJson = {
  title: string;
  sections: unknown[];
  citations: Record<string, unknown>;
};

export const researchRuns = sqliteTable(
  'research_runs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(),
    status: text('status', {
      enum: ['queued', 'running', 'awaiting_confirm', 'completed', 'failed', 'cancelled'],
    })
      .notNull()
      .default('queued'),
    useNotebookSources: bool('use_notebook_sources', true),
    allowWeb: bool('allow_web', true),
    sourceIds: text('source_ids', { mode: 'json' }).$type<number[] | null>(),
    depth: text('depth', { enum: ['shallow', 'medium', 'deep'] })
      .notNull()
      .default('medium'),
    maxSearches: integer('max_searches').notNull(),
    maxNodes: integer('max_nodes').notNull(),
    searchesUsed: integer('searches_used').notNull().default(0),
    /** Independent page-fetch budget (c107). */
    maxPageFetches: integer('max_page_fetches').notNull(),
    pagesUsed: integer('pages_used').notNull().default(0),
    graph: json<ResearchGraphJson>('graph'),
    checkpoint: json<ResearchCheckpointJson | null>('checkpoint'),
    report: json<ResearchReportJson | null>('report'),
    confirmKind: text('confirm_kind', { enum: ['budget', 'expand_branch', 'reexpand'] }),
    confirmBranchNodeId: text('confirm_branch_node_id'),
    cancelRequested: bool('cancel_requested', false),
    errorMessage: text('error_message'),
    /** Optional chat model id for synthesize / node short synthesis. */
    modelId: text('model_id'),
    /** Active revision pointer (UI highlight). */
    activeRevisionId: text('active_revision_id'),
    /** Scheduler / focus node (also chat / work_unit subject). */
    activeNodeId: text('active_node_id'),
    /** LLM mutex: null | work_unit | node_chat. */
    llmActivity: text('llm_activity', { enum: ['work_unit', 'node_chat'] }),
    /** Canonical report last change. */
    reportUpdatedAt: tsNull('report_updated_at'),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [index('ix_research_runs_notebook_id_updated_at').on(t.notebookId, t.updatedAt)],
);

export const researchEvidences = sqliteTable(
  'research_evidences',
  {
    id: text('id').primaryKey(),
    runId: integer('run_id')
      .notNull()
      .references(() => researchRuns.id, { onDelete: 'cascade' }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['web', 'chunk'] }).notNull(),
    title: text('title').notNull(),
    snippet: text('snippet'),
    /** Truncated page body from fetchPage (c107). */
    content: text('content'),
    url: text('url'),
    sourceId: integer('source_id'),
    chunkId: text('chunk_id'),
    collectedAtNodeId: text('collected_at_node_id'),
    createdAt: ts('created_at'),
  },
  (t) => [
    index('ix_research_evidences_run_id').on(t.runId),
    index('ix_research_evidences_notebook_id').on(t.notebookId),
  ],
);

/** User-visible graph+report snapshots. */
export const researchRevisions = sqliteTable(
  'research_revisions',
  {
    id: text('id').primaryKey(),
    runId: integer('run_id')
      .notNull()
      .references(() => researchRuns.id, { onDelete: 'cascade' }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    kind: text('kind', {
      enum: ['auto_complete', 'user_save', 'restore_point'],
    }).notNull(),
    parentRevisionId: text('parent_revision_id'),
    graph: jsonReq<ResearchGraphJson>('graph'),
    report: json<ResearchReportJson | null>('report'),
    searchesUsed: integer('searches_used').notNull().default(0),
    statusAtSave: text('status_at_save').notNull(),
    createdAt: ts('created_at'),
  },
  (t) => [index('ix_research_revisions_run_id_created_at').on(t.runId, t.createdAt)],
);

/** Report working copy (one row per run, CoW vs canonical). */
export const researchReportEdits = sqliteTable('research_report_edits', {
  runId: integer('run_id')
    .primaryKey()
    .references(() => researchRuns.id, { onDelete: 'cascade' }),
  baseReportUpdatedAt: tsNull('base_report_updated_at'),
  report: jsonReq<ResearchReportJson>('report'),
  updatedAt: tsUpd('updated_at'),
  updatedBy: text('updated_by'),
});

/** Append-only progress ledger. */
export const researchProgressEvents = sqliteTable(
  'research_progress_events',
  {
    id: text('id').primaryKey(),
    runId: integer('run_id')
      .notNull()
      .references(() => researchRuns.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    at: ts('at'),
    kind: text('kind').notNull(),
    nodeId: text('node_id'),
    headline: text('headline'),
    payload: json<Record<string, unknown> | null>('payload'),
  },
  (t) => [
    uniqueIndex('uq_research_progress_events_run_id_seq').on(t.runId, t.seq),
    index('ix_research_progress_events_run_id_at').on(t.runId, t.at),
  ],
);

export const researchRunRelations = relations(researchRuns, ({ one, many }) => ({
  notebook: one(notebooks, { fields: [researchRuns.notebookId], references: [notebooks.id] }),
  evidences: many(researchEvidences),
  revisions: many(researchRevisions),
  reportEdit: one(researchReportEdits),
  progressEvents: many(researchProgressEvents),
}));

export const researchEvidenceRelations = relations(researchEvidences, ({ one }) => ({
  run: one(researchRuns, { fields: [researchEvidences.runId], references: [researchRuns.id] }),
  notebook: one(notebooks, {
    fields: [researchEvidences.notebookId],
    references: [notebooks.id],
  }),
}));

export const researchRevisionRelations = relations(researchRevisions, ({ one }) => ({
  run: one(researchRuns, { fields: [researchRevisions.runId], references: [researchRuns.id] }),
  notebook: one(notebooks, {
    fields: [researchRevisions.notebookId],
    references: [notebooks.id],
  }),
}));

export const researchReportEditRelations = relations(researchReportEdits, ({ one }) => ({
  run: one(researchRuns, { fields: [researchReportEdits.runId], references: [researchRuns.id] }),
}));

export const researchProgressEventRelations = relations(researchProgressEvents, ({ one }) => ({
  run: one(researchRuns, {
    fields: [researchProgressEvents.runId],
    references: [researchRuns.id],
  }),
}));

// ---------------------------------------------------------------------------
// Barrel — table map passed to `drizzle({ schema })` for relational queries
// ---------------------------------------------------------------------------

export const schema = {
  notebooks,
  notebookExtractorPolicies,
  strategyConfigs,
  templates,
  promptPresets,
  sessions,
  messages,
  sources,
  chunks,
  sourceTags,
  sourceTagMap,
  sourceConnectorBindings,
  outputs,
  studioSlides,
  researchRuns,
  researchEvidences,
  researchRevisions,
  researchReportEdits,
  researchProgressEvents,
};

export type Schema = typeof schema;
