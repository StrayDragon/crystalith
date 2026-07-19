import type { JsonMetadata } from '@crystalith/shared';
// Drizzle ORM schema for Crystalith v2 — single SQLite database.
//
// Maps the business tables 1:1 (incl. strategy_configs for RAG) and adds 4
// eval-harness tables (eval_datasets / eval_items / eval_runs / eval_run_items)
// so the full schema is provisioned via Drizzle migrations. The sqlite-vec
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
  researchSessions: many(researchSessions),
  strategyConfigs: many(strategyConfigs),
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
    metadata: json('metadata'),
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
    metadata: json('metadata'),
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
    connectionConfig: jsonReq('connection_config'),
    importScope: json('import_scope'),
    lastConfirmedSnapshot: json('last_confirmed_snapshot'),
    lastSyncCheckResult: json('last_sync_check_result'),
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
    outline: json('outline'),
    markdown: text('markdown'),
    generationConfig: json('generation_config'),
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
// Research sessions + steps
// ---------------------------------------------------------------------------

export const researchSessions = sqliteTable(
  'research_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(),
    status: text('status', {
      enum: ['planning', 'searching', 'analyzing', 'waiting_user', 'completed', 'cancelled'],
    })
      .notNull()
      .default('planning'),
    currentIteration: integer('current_iteration').notNull().default(1),
    maxIterations: integer('max_iterations').notNull().default(4),
    aggregatedResults: text('aggregated_results', { mode: 'json' }).$type<unknown[] | null>(),
    finalReport: text('final_report'),
    lockedAt: tsNull('locked_at'),
    lockExpiresAt: tsNull('lock_expires_at'),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [index('ix_research_sessions_status').on(t.status)],
);

export const researchSessionRelations = relations(researchSessions, ({ one, many }) => ({
  notebook: one(notebooks, {
    fields: [researchSessions.notebookId],
    references: [notebooks.id],
  }),
  steps: many(researchSteps),
}));

export const researchSteps = sqliteTable(
  'research_steps',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => researchSessions.id, { onDelete: 'cascade' }),
    iteration: integer('iteration').notNull(),
    type: text('type', {
      enum: ['plan', 'search', 'search_result', 'analyze', 'user_input', 'summary'],
    }).notNull(),
    inputData: json('input_data'),
    outputData: json('output_data'),
    status: text('status', {
      enum: ['pending', 'running', 'completed', 'skipped'],
    })
      .notNull()
      .default('pending'),
    createdAt: ts('created_at'),
  },
  (t) => [index('ix_research_steps_session_iteration').on(t.sessionId, t.iteration)],
);

export const researchStepRelations = relations(researchSteps, ({ one }) => ({
  session: one(researchSessions, {
    fields: [researchSteps.sessionId],
    references: [researchSessions.id],
  }),
}));

// ---------------------------------------------------------------------------
// Tasks (background job queue)
// ---------------------------------------------------------------------------

export const tasks = sqliteTable(
  'tasks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id').references(() => notebooks.id, { onDelete: 'set null' }),
    type: text('type', { enum: ['refine', 'document_parse'] }).notNull(),
    status: text('status', {
      enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    })
      .notNull()
      .default('pending'),
    payload: jsonReq('payload'),
    result: json('result'),
    error: text('error'),
    progress: integer('progress').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [index('ix_tasks_notebook_id_status').on(t.notebookId, t.status)],
);

// ---------------------------------------------------------------------------
// Eval harness (new in v2): datasets, items, runs, run_items
// ---------------------------------------------------------------------------

export const evalDatasets = sqliteTable('eval_datasets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  notebookId: integer('notebook_id').references(() => notebooks.id, { onDelete: 'set null' }),
  createdAt: ts('created_at'),
  updatedAt: tsUpd('updated_at'),
});

export const evalDatasetRelations = relations(evalDatasets, ({ one, many }) => ({
  notebook: one(notebooks, { fields: [evalDatasets.notebookId], references: [notebooks.id] }),
  items: many(evalItems),
  runs: many(evalRuns),
}));

export const evalItems = sqliteTable(
  'eval_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    datasetId: integer('dataset_id')
      .notNull()
      .references(() => evalDatasets.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    expectedAnswer: text('expected_answer').notNull(),
    expectedSources: text('expected_sources', { mode: 'json' }).$type<number[] | null>(),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at'),
  },
  (t) => [index('ix_eval_items_dataset_id').on(t.datasetId)],
);

export const evalItemRelations = relations(evalItems, ({ one }) => ({
  dataset: one(evalDatasets, { fields: [evalItems.datasetId], references: [evalDatasets.id] }),
}));

export const evalRuns = sqliteTable(
  'eval_runs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    datasetId: integer('dataset_id')
      .notNull()
      .references(() => evalDatasets.id, { onDelete: 'cascade' }),
    strategyIds: text('strategy_ids', { mode: 'json' }).$type<string[]>().notNull(),
    status: text('status', { enum: ['running', 'completed', 'failed', 'cancelled'] })
      .notNull()
      .default('running'),
    startedAt: ts('started_at'),
    finishedAt: tsNull('finished_at'),
    summary: json('summary'),
  },
  (t) => [index('ix_eval_runs_dataset_id').on(t.datasetId)],
);

export const evalRunRelations = relations(evalRuns, ({ one, many }) => ({
  dataset: one(evalDatasets, { fields: [evalRuns.datasetId], references: [evalDatasets.id] }),
  items: many(evalRunItems),
}));

export const evalRunItems = sqliteTable(
  'eval_run_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    runId: integer('run_id')
      .notNull()
      .references(() => evalRuns.id, { onDelete: 'cascade' }),
    itemId: integer('item_id')
      .notNull()
      .references(() => evalItems.id, { onDelete: 'cascade' }),
    strategyId: text('strategy_id').notNull(),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    retrievedSourceIds: text('retrieved_source_ids', { mode: 'json' })
      .$type<number[]>()
      .notNull()
      .default(sql`'[]'`),
    metrics: jsonReq('metrics'),
    createdAt: ts('created_at'),
  },
  (t) => [index('ix_eval_run_items_run_id_strategy_id').on(t.runId, t.strategyId)],
);

export const evalRunItemRelations = relations(evalRunItems, ({ one }) => ({
  run: one(evalRuns, { fields: [evalRunItems.runId], references: [evalRuns.id] }),
  item: one(evalItems, { fields: [evalRunItems.itemId], references: [evalItems.id] }),
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
  researchSessions,
  researchSteps,
  tasks,
  evalDatasets,
  evalItems,
  evalRuns,
  evalRunItems,
};

export type Schema = typeof schema;
