// Research domain (c76+) — runs, evidences, revisions, report edits,
// progress ledger.
import type { ResearchEdge, ResearchNode, ResearchReport } from '@crystalith/shared';
import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { bool, json, jsonReq, ts, tsNull, tsUpd } from './columns.ts';
import { notebooks } from './notebooks.ts';

/** Graph JSON stored on research_runs (aligned with shared ResearchNode/Edge). */
export type ResearchGraphJson = {
  nodes: ResearchNode[];
  edges: ResearchEdge[];
};

/** Checkpoint blob (CP1). */
export type ResearchCheckpointJson = {
  at: string;
  status: string;
  searchesUsed: number;
  nodeCount: number;
  reason?: string;
};

/** Report JSON on research_runs (aligned with shared ResearchReport). */
export type ResearchReportJson = ResearchReport;

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
